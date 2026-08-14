extends Node
## （注：Autoload 脚本不加 class_name —— Godot 4.7 硬错误「Class X hides an autoload singleton」，
## 见 EventBus 脚本注与 engine-reference K10。单例以注册名 SaveManager 作为全局句柄。）

## SaveManager · 存档/读档/槽位/跨系统原子写（基础层 F4 = X4）。
## 参考：architecture §9（§9.1 持久化范围 / §9.2 原子写+一致性校验 / §9.3 多槽位+版本）；
##       control-manifest 存档节；adr-002（数据驱动）/ adr-004（信号驱动）/ adr-005（朝代命名空间）。
##       各系统 GDD §3.x 存档清单：rewrite-causality §3.6 / mainline-quest §3.3 /
##       panel-progression §3.3 / open-world §3.6 / combat §3.5（Loop B 不持久化）。
##
## 持久化范围（守 §9.1 / control-manifest 存档节）：
##   - C1（rewrite_engine）/ C2（mainline_quest）：已落地，serialize()/deserialize() 可用 → 真实快照。
##   - C3（panel_progression）/ C5（open_world）：**尚未落地**（P5-4/P5-7 未合入）→ 防御性空快照，
##     不因前置未就绪而崩（issue #20 验收要点 4）。落地后在 apply_pending_load 补 deserialize。
##   - C4（combat）：Loop B 瞬态（HP/BF/alert/敌人实例），**不持久化**；读档满血+清警戒由 C4/C5 重建。
##
## 原子写（§9.2）：单次事务写临时文件 + DirAccess.rename_absolute → 同一存档文件，禁分散写。
##   引擎 API：FileAccess（读写）+ DirAccess.rename_absolute（rename）+ var_to_str/str_to_var（序列化）。
##   ⚠️待核（engine-reference K6）：Windows 上 DirAccess.rename_absolute 的原子性；var_to_str 嵌套 dict 边界。
##   本实现用 var_to_str（文本，可读，原生支持嵌套 Dictionary/Array/基础类型），避免 ConfigFile 嵌套 dict 边界。
##
## 多槽位 + 版本（§9.3）：≥3 槽；存档头含 schema_version；留读档迁移钩子（_migrate）。
##   精确迁移策略（schema_version>1 时字段增删/重命名）⚠️待核，留 P6 落地；当前仅 schema_version=1。
##
## 存档触发（§9.2 / control-manifest 信号节）：监听 EventBus.node_resolved（节点确认后自动存档到当前游玩槽）+
##   手动存档入口（暂停菜单，本 issue 不建暂停菜单；API 已暴露 atomic_save(slot) 供其调用）。
##   **禁轮询**（control-manifest）：仅信号驱动。

# ── schema / 槽位常量（§9.3）──
const SCHEMA_VERSION := 1
const NUM_SLOTS := 3
const SAVE_DIR := "user://saves/"
const SNAPSHOT_TAG := "chibi_rewriter.save"   # 存档根 dict 标识（防误读非存档文件）

# ── 运行时态（SaveManager 不持业务态，只持「当前游玩槽 + 待注入快照」）──
var _active_slot: int = -1          # 当前游玩槽（new_game/continue 设置；atomic_save 用之）
var _pending_load: Dictionary = {}  # 待注入快照（continue 预载；world._ready 消费）
var _recent_slot: int = -1          # 最近存档槽（list_slots 扫描后缓存；主菜单「继续」默认聚焦用）


func _ready() -> void:
	_ensure_save_dir()
	_recent_slot = _scan_recent_slot()
	# 存档触发（architecture §9.2 / control-manifest 信号节：监听 node_resolved，禁轮询）。
	EventBus.node_resolved.connect(_on_node_resolved)


func _exit_tree() -> void:
	# adr-004：切场景/销毁时 disconnect 防悬挂回调（只断本对象自己的连接）。
	for c in EventBus.node_resolved.get_connections():
		if c.callable.get_object() == self:
			EventBus.node_resolved.disconnect(c.callable)


# ═══════════════════════════ 槽位查询（主菜单 UI 用） ═══════════════════════════

func has_any_save() -> bool:
	return _recent_slot >= 0

## 最近存档槽（用于主菜单「继续」默认聚焦）。无存档返回 -1。
func get_recent_slot() -> int:
	return _recent_slot

## 全部槽位摘要（按槽号升序）。每项见 _empty_summary / _summary_from_snapshot 字段。
func list_slots() -> Array:
	var out: Array = []
	for i in NUM_SLOTS:
		out.append(get_slot_summary(i))
	return out

## 单槽摘要（读全量快照提取展示字段；3 槽数据量小，可接受）。
func get_slot_summary(slot: int) -> Dictionary:
	var snap := _read_slot(slot)
	if snap.is_empty():
		return _empty_summary(slot)
	return _summary_from_snapshot(slot, snap)


func _empty_summary(slot: int) -> Dictionary:
	return {
		"slot": slot,
		"empty": true,
		"dynasty": String(DynastyLoader.DEFAULT_DYNASTY),
		"chapter_id": "",
		"chapter_progress": 0.0,
		"delta_total": 0,
		"worldline_shaken": false,
		"saved_at": 0,
		"saved_at_text": "—",
	}


func _summary_from_snapshot(slot: int, snap: Dictionary) -> Dictionary:
	var systems: Dictionary = snap.get("systems", {})
	var c1: Dictionary = systems.get("rewrite_engine", {})
	var c2: Dictionary = systems.get("mainline_quest", {})
	# Δ 累计 = Σ resolved_nodes[].delta_node（rewrite-causality §3.6）
	var delta_total := 0
	var resolved: Dictionary = c1.get("resolved_nodes", {})
	for k in resolved:
		var rec: Dictionary = resolved[k]
		delta_total += int(rec.get("delta_node", 0))
	var crit: Dictionary = c1.get("critical_flags", {})
	var saved_at := int(snap.get("saved_at", 0))
	return {
		"slot": slot,
		"empty": false,
		"dynasty": String(snap.get("active_dynasty", String(DynastyLoader.DEFAULT_DYNASTY))),
		"chapter_id": String(c2.get("active_chapter", "")),
		"chapter_progress": float(c2.get("chapter_progress", 0.0)),
		"delta_total": delta_total,
		"worldline_shaken": bool(crit.get("worldline_shaken", false)),
		"saved_at": saved_at,
		"saved_at_text": _format_time(saved_at),
	}


# ═══════════════════════════ 新游戏 / 继续（主菜单入口） ═══════════════════════════

## 新游戏：选首个空槽（全满则槽 0），清待注入快照（world 启动走 baseline）。
## 返回 {ok, slot}。槽位选择由 UI 二次确认把关（§9.3 覆盖弹窗）。
func new_game() -> Dictionary:
	var slot := _first_empty_slot()
	_active_slot = slot
	_pending_load.clear()
	return {"ok": true, "slot": slot}

## 指定槽位开始新游戏（覆盖）：清待注入快照，world 启动走 baseline；存档时覆盖该槽。
func new_game_to_slot(slot: int) -> Dictionary:
	if not _is_valid_slot(slot):
		return {"ok": false, "reason": "invalid_slot"}
	_active_slot = slot
	_pending_load.clear()
	return {"ok": true, "slot": slot}

## 继续游戏（最近槽）：读快照 + 一致性校验 → _pending_load。
func continue_game() -> Dictionary:
	if _recent_slot < 0:
		return {"ok": false, "reason": "no_save"}
	return continue_slot(_recent_slot)

## 指定槽继续：读快照 + 一致性校验 → _pending_load（world._ready 注入）。
func continue_slot(slot: int) -> Dictionary:
	if not _is_valid_slot(slot):
		return {"ok": false, "reason": "invalid_slot"}
	var res := load_slot(slot)
	if not res.ok:
		return res
	_active_slot = slot
	_pending_load = res.snapshot
	return {"ok": true, "slot": slot}


# ═══════════════════════════ 存 / 读（核心 API） ═══════════════════════════

## 读档：读快照 + schema 迁移钩子 + 一致性校验（C1 resolved == C2 confirmed）。
## 返回 {ok, reason, snapshot?, errors?}。不一致即拒绝读档报错（control-manifest 存档节，不静默修复）。
func load_slot(slot: int) -> Dictionary:
	var snap := _read_slot(slot)
	if snap.is_empty():
		return {"ok": false, "reason": "empty_slot"}
	snap = _migrate(snap)
	var systems: Dictionary = snap.get("systems", {})
	var c1: Dictionary = systems.get("rewrite_engine", {})
	var c2: Dictionary = systems.get("mainline_quest", {})
	# 一致性校验（control-manifest 存档节 / architecture §9.2 / mainline §3.3）。
	var chk := RewriteCausalityEngine.check_save_consistency(c1, c2)
	if not chk.ok:
		push_error("[SaveManager] 槽 %d 一致性校验失败：%s" % [slot, str(chk.errors)])
		return {"ok": false, "reason": "consistency_failed", "errors": chk.errors, "snapshot": snap}
	return {"ok": true, "reason": "ok", "snapshot": snap}

## 原子存档：收集 C1/C2/C3/C5 快照 → 单次事务写（临时文件 + rename）。
## 返回 {ok, reason?, slot?}。由 node_resolved 自动触发（_active_slot）或暂停菜单手动调。
func atomic_save(slot: int) -> Dictionary:
	if not _is_valid_slot(slot):
		return {"ok": false, "reason": "invalid_slot"}
	var snapshot := _collect_snapshot()
	snapshot["tag"] = SNAPSHOT_TAG
	snapshot["schema_version"] = SCHEMA_VERSION
	snapshot["saved_at"] = int(Time.get_unix_time_from_system())
	snapshot["active_dynasty"] = _snapshot_dynasty(snapshot)
	var written := _atomic_write(slot, snapshot)
	if not written.ok:
		return written
	_recent_slot = slot
	return {"ok": true, "reason": "ok", "slot": slot}


# ═══════════════════════════ 待注入快照（world._ready 消费） ═══════════════════════════

func has_pending_load() -> bool:
	return not _pending_load.is_empty()

## world._ready 调用：把预载快照 deserialize 到 C1/C2（C3/C5 待落地）。
## 调用后清空 _pending_load（一次性注入）。world._ready 在 Systems 子节点 _ready 之后执行。
func apply_pending_load() -> void:
	if _pending_load.is_empty():
		return
	var systems: Dictionary = _pending_load.get("systems", {})
	# C1（RewriteCausalityEngine，issue #17 已落地）
	var c1n: Node = get_tree().get_first_node_in_group("rewrite_engine")
	if c1n is RewriteCausalityEngine:
		(c1n as RewriteCausalityEngine).deserialize(systems.get("rewrite_engine", {}))
	else:
		push_warning("[SaveManager] apply_pending_load 未找到 rewrite_engine 节点（跳过 C1 注入）")
	# C2（QuestSystem，issue #16 已落地）
	var c2n: Node = get_tree().get_first_node_in_group("quest_system")
	if c2n is QuestSystem:
		(c2n as QuestSystem).deserialize(systems.get("mainline_quest", {}))
	else:
		push_warning("[SaveManager] apply_pending_load 未找到 quest_system 节点（跳过 C2 注入）")
	# C3（PanelProgression）/ C5（OpenWorldSystem）尚未落地 → 待该 issue 合入后在此 deserialize。
	# 当前 _collect_snapshot 已存防御性空快照，不丢字段结构。
	_pending_load.clear()


func clear_pending_load() -> void:
	_pending_load.clear()


func get_active_slot() -> int:
	return _active_slot


# ═══════════════════════════ 内部：快照收集（数据驱动，对齐 GDD 变量名） ═══════════════════════════

## 收集四系统持久态（architecture §9.1）。已落地系统真实快照；未落地系统防御性空快照。
func _collect_snapshot() -> Dictionary:
	var snap: Dictionary = {}
	snap["rewrite_engine"] = _serialize_system("rewrite_engine")        # C1（rewrite-causality §3.6）
	snap["mainline_quest"] = _serialize_system("quest_system")          # C2（mainline §3.3）
	snap["panel_progression"] = _serialize_optional_panel()             # C3 防御性空（panel §3.3，待落地）
	snap["open_world"] = {}                                              # C5 防御性空（open-world §3.6，待落地）
	return {"systems": snap}


## 经节点分组定位系统，调其 serialize()（adr-004 节点分组寻址；control-manifest 禁全局态）。
func _serialize_system(group_name: String) -> Dictionary:
	var n: Node = get_tree().get_first_node_in_group(group_name)
	if n != null and is_instance_valid(n) and n.has_method("serialize"):
		return n.serialize()
	return {}   # 防御性空（系统未就绪/未挂载；不崩，读档时该系统保持 baseline）


## C3（PanelProgression）尚未落地 → 预留稳定字段结构（panel §3.3），落地后由该系统 serialize 填充。
func _serialize_optional_panel() -> Dictionary:
	var n: Node = get_tree().get_first_node_in_group("panel_progression")
	if n != null and is_instance_valid(n) and n.has_method("serialize"):
		return n.serialize()
	return {
		"schema": "panel_progression.v1",
		"available": false,   # 系统未落地标记（落地后改 true）
	}


func _snapshot_dynasty(snap: Dictionary) -> String:
	var c1: Dictionary = snap.get("systems", {}).get("rewrite_engine", {})
	var dyn := String(c1.get("active_dynasty", ""))
	if dyn == "":
		return String(DynastyLoader.DEFAULT_DYNASTY)
	return dyn


# ═══════════════════════════ 内部：原子写 / 读（§9.2 / engine-reference K6） ═══════════════════════════

## 原子写：写临时文件（flush+close）→ DirAccess.rename_absolute → 最终路径（§9.2 单次事务）。
func _atomic_write(slot: int, snapshot: Dictionary) -> Dictionary:
	var final_path := _slot_path(slot)
	var tmp_path := _slot_path_tmp(slot)
	var f := FileAccess.open(tmp_path, FileAccess.WRITE)
	if f == null:
		return {"ok": false, "reason": "open_fail:%d" % FileAccess.get_open_error()}
	f.store_string(var_to_str(snapshot))
	f.flush()
	f.close()
	# rename 实现原子替换（旧槽文件存在则覆盖；rename 原子性依赖文件系统，⚠️待核 Windows，engine-ref K6）。
	var err := DirAccess.rename_absolute(tmp_path, final_path)
	if err != OK:
		# 清理残留临时文件，避免下次 open 冲突。
		var d := DirAccess.open(SAVE_DIR)
		if d != null:
			var tmp_name := tmp_path.get_file()
			if d.file_exists(tmp_name):
				d.remove(tmp_name)
		return {"ok": false, "reason": "rename_fail:%d" % err}
	return {"ok": true}


## 读槽快照（var_to_str 文本 → str_to_var）。空/损坏文件回 {}（调用方判 empty）。
func _read_slot(slot: int) -> Dictionary:
	var path := _slot_path(slot)
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var text := f.get_as_text()
	f.close()
	if text.strip_edges() == "":
		return {}
	var parsed = str_to_var(text)
	if not (parsed is Dictionary):
		push_warning("[SaveManager] 槽 %d 存档损坏（非 Dictionary），忽略" % slot)
		return {}
	return parsed


func _slot_path(slot: int) -> String:
	return "%sslot_%d.sav" % [SAVE_DIR, slot]


func _slot_path_tmp(slot: int) -> String:
	return "%s.slot_%d.tmp" % [SAVE_DIR, slot]


func _ensure_save_dir() -> void:
	var d := DirAccess.open("user://")
	if d == null:
		push_warning("[SaveManager] 无法打开 user:// 目录")
		return
	if not d.dir_exists("saves"):
		d.make_dir("saves")


func _is_valid_slot(slot: int) -> bool:
	return slot >= 0 and slot < NUM_SLOTS


func _first_empty_slot() -> int:
	for i in NUM_SLOTS:
		if not FileAccess.file_exists(_slot_path(i)):
			return i
	return 0   # 全满 → 默认槽 0（覆盖由 UI 二次确认把关，§9.3）


## 扫描全部槽位，按 saved_at 取最近槽。无存档返回 -1。
func _scan_recent_slot() -> int:
	var best := -1
	var best_time := 0
	for i in NUM_SLOTS:
		var snap := _read_slot(i)
		if snap.is_empty():
			continue
		var t := int(snap.get("saved_at", 0))
		if t > best_time:
			best_time = t
			best = i
	return best


# ═══════════════════════════ schema 迁移钩子（§9.3，⚠️待核，留 P6 落地） ═══════════════════════════

## 读档迁移：schema_version > 当前版本时做字段增删/重命名。当前仅 v1，无迁移；预留钩子。
## ⚠️待核：精确迁移策略（字段增删默认值/重命名映射）留 P6；本切片 schema_version 恒为 1。
func _migrate(snap: Dictionary) -> Dictionary:
	var v := int(snap.get("schema_version", SCHEMA_VERSION))
	if v == SCHEMA_VERSION:
		return snap
	# TODO(p6-save-migrate): v > SCHEMA_VERSION 时按版本阶梯迁移字段。
	push_warning("[SaveManager] 存档 schema_version=%d（当前 %d），迁移策略待 P6 落地，按原样读" % [v, SCHEMA_VERSION])
	return snap


# ═══════════════════════════ EventBus 接收（存档触发 · §9.2 / control-manifest 信号节） ═══════════════════════════

## node_resolved（S1→X4）：节点确认后自动存档到当前游玩槽（§9.2 存档触发）。
func _on_node_resolved(_node_id: StringName, _final_vars: Dictionary, _delta_node: int, _cp_earned: int) -> void:
	if _active_slot < 0:
		push_warning("[SaveManager] node_resolved 触发存档但 _active_slot 未设置（忽略，可能未从主菜单进入）")
		return
	var res := atomic_save(_active_slot)
	if not res.ok:
		push_error("[SaveManager] 自动存档失败（槽 %d）：%s" % [_active_slot, str(res)])


# ═══════════════════════════ 辅助 ═══════════════════════════

## 格式化存档时间（本地时区）。失败回 "—"。
func _format_time(unix_epoch: int) -> String:
	if unix_epoch <= 0:
		return "—"
	var dt := Time.get_datetime_dict_from_unix_time(unix_epoch)
	if dt.is_empty():
		return "—"
	# %d 补零：Godot 4 String 格式化 "%02d"
	return "%04d-%02d-%02d %02d:%02d" % [int(dt.get("year", 0)), int(dt.get("month", 0)), int(dt.get("day", 0)), int(dt.get("hour", 0)), int(dt.get("minute", 0))]


# ═══════════════════════════ 测试/调试辅助（A7 可测试；不绕过 DAG，仅注入测试态） ═══════════════════════════

## 测试辅助：直接注入待注入快照（绕过 continue_slot 读档，供 world 读档重同步单测）。
func debug_set_pending_load(snapshot: Dictionary) -> void:
	_pending_load = snapshot

## 测试辅助：直接置当前游玩槽。
func debug_set_active_slot(slot: int) -> void:
	_active_slot = slot

## 测试辅助：重置运行时态（不删磁盘存档）。
func debug_reset_runtime() -> void:
	_active_slot = -1
	_pending_load.clear()
	_recent_slot = _scan_recent_slot()
