class_name CausalLinksData
extends Resource
## CausalLinksData · 因果链聚合表（数据驱动 · S1 唯一所有者 · rewrite-causality §3.4 / §2.5）。
##
## 落 data/causal_links/<dynasty>.tres（赤壁 = causal_links_chibi.tres）。聚合本朝代全部因果链。
## 范围红线（§2.5/§5.2）：垂直切片限 3 节点最小链（N1→N2→N3），存在性依赖最多一层。
##
## 被 RewriteCausalityEngine._load_causal_links / _resolve_causal_chain 读。
## 参考：architecture §6.2；adr-002。

## 朝代命名空间（dyn_threekingdoms_chibi；本表所属命名空间，热切换 key）。
@export var dynasty: StringName = &""

## 本朝代全部因果链（C1 按 source_node 查出向链解析下游）。
@export var links: Array[CausalLinkData] = []


## 取从 source_node 出向的全部链（供 C1 节点确认后沿因果链解析下游，§2.5）。
func get_outgoing_links(source_node: StringName) -> Array[CausalLinkData]:
	var out: Array[CausalLinkData] = []
	for l in links:
		if l != null and l.source_node == source_node:
			out.append(l)
	return out
