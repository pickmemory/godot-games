extends Node

## AudioManager · 全局音频 autoload（mmx 真实占位资产接线 · P6-1）。
## - BGM 四态切换：menu / explore / combat / choice（淡入淡出，跨场景持久）。
## - VO 系统旁白：接 EventBus 的 voiced 信号自动播（dispatch / vanish / complete）。
## 参考：art-bible §1.2/§2（情绪调色）/ asset-manifest §6（音频）/ sound-design.md。
##
## autoload 单例；AudioStreamPlayer 挂本节点，切换场景不中断。其他脚本：AudioManager.play_music("explore")。

const _FADE_IN := 0.6
const _FADE_OUT := 0.5
const _MUTE_DB := -40.0
const _MUSIC_DB := -8.0

var _music: AudioStreamPlayer
var _vo: AudioStreamPlayer
var _tween: Tween
var _bgm: Dictionary = {}        # key -> AudioStream（loop）
var _vo_clips: Dictionary = {}   # key -> AudioStream（oneshot）


func _ready() -> void:
	_music = AudioStreamPlayer.new()
	_music.name = "MusicPlayer"
	_music.bus = "Master"
	add_child(_music)
	_vo = AudioStreamPlayer.new()
	_vo.name = "VoPlayer"
	_vo.bus = "Master"
	add_child(_vo)
	# BGM
	_reg_bgm("menu", "res://assets/audio/bgm_menu.mp3")
	_reg_bgm("explore", "res://assets/audio/bgm_explore.mp3")
	_reg_bgm("combat", "res://assets/audio/bgm_combat.mp3")
	_reg_bgm("choice", "res://assets/audio/bgm_choice.mp3")
	# VO 系统旁白
	_reg_vo("dispatch", "res://assets/audio/vo_system_dispatch.mp3")
	_reg_vo("vanish", "res://assets/audio/vo_system_vanish.mp3")
	_reg_vo("complete", "res://assets/audio/vo_system_complete.mp3")
	# 接 EventBus voiced 信号 → 自动播旁白（control-manifest 跨系统信号就近消费）
	EventBus.quest_dispatch_voiced.connect(_on_dispatch_voiced)
	EventBus.quest_node_vanished_voiced.connect(_on_vanish_voiced)
	EventBus.node_resolved.connect(_on_node_resolved)


func _reg_bgm(key: String, path: String) -> void:
	var s: AudioStream = load(path) as AudioStream
	if s == null:
		push_warning("[AudioManager] BGM 缺失：%s" % path)
		return
	s.loop = true
	_bgm[key] = s


func _reg_vo(key: String, path: String) -> void:
	var s: AudioStream = load(path) as AudioStream
	if s == null:
		push_warning("[AudioManager] VO 缺失：%s" % path)
		return
	s.loop = false
	_vo_clips[key] = s


## 播放/切换 BGM（同曲已在播则不重启；否则淡出旧曲 + 淡入新曲）。
func play_music(key: String) -> void:
	if not _bgm.has(key):
		return
	var stream: AudioStream = _bgm[key]
	if _music.stream == stream and _music.playing:
		return
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_music.stream = stream
	_music.volume_db = _MUTE_DB
	_music.play()
	_tween = create_tween()
	_tween.tween_property(_music, "volume_db", _MUSIC_DB, _FADE_IN)


func stop_music() -> void:
	if not _music.playing:
		return
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(_music, "volume_db", _MUTE_DB, _FADE_OUT)
	_tween.tween_callback(_music.stop)


## 播放一段系统旁白 VO（叠在 BGM 上，不中断 BGM）。
func play_vo(key: String) -> void:
	if not _vo_clips.has(key):
		return
	_vo.stream = _vo_clips[key]
	_vo.play()


# ── EventBus voiced 信号 → VO 自动播 ──

func _on_dispatch_voiced(_node_id: StringName, _voice: String) -> void:
	play_vo("dispatch")

func _on_vanish_voiced(_node_id: StringName, _voice: String) -> void:
	play_vo("vanish")

func _on_node_resolved(_node_id: StringName, _final_vars: Dictionary, _delta_node: int, _cp_earned: int) -> void:
	play_vo("complete")
