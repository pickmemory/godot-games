# 模块地图（web/src）

> **自动提取**（scripts/ai-context/refresh.sh → extract.mjs）。改代码后重跑同步，勿手改。
> 入口：web/index.html → src/main.js（装配根，全部系统在此汇流接线）。
> 约定：模块间只经导出签名通信；main.js 是唯一允许知悉所有模块的地方。

| 模块 | 行数 | 本地依赖 | 被谁依赖 | 主要导出 |
|---|---|---|---|---|
| blocks | 203 | items | building crafting drops explore farming helditem interaction lights main mesher mob npc player save structure terrain textures ui world | CHUNK_X, CHUNK_Y, CHUNK_Z, CHUNK_VOL, TILE, BLOCK …(15) |
| building | 260 | blocks | main | FALLBACK_BUILDING, Building |
| chapter | 294 | — | main npc | dateToSerial, serialToDate, FALLBACK_CHAPTER, normalizeChapter, loadChapter, ChapterTimeline |
| crafting | 112 | blocks items | main | FALLBACK_RECIPES, Crafting |
| cutscene | 94 | — | main | Cutscene |
| diag | 90 | — | main | DIAG_VERSION, dlog, installDiag |
| dialog | 123 | — | main | FALLBACK_DIALOGS, DialogUI |
| drops | 211 | blocks items | main | DropManager |
| explore | 413 | blocks terrain | main world | FALLBACK_EXPLORE, anchorAt, stampExplore, bearingTo, nearestTarget, ExploredMemory |
| farming | 312 | blocks items | main | FALLBACK_FARMING, Farming |
| health | 78 | — | main | Health |
| helditem | 130 | items textures blocks | main | HeldItem |
| interaction | 193 | blocks mining textures | main | Interaction |
| inventory | 91 | items | main | Inventory |
| items | 146 | — | blocks crafting drops farming helditem inventory mining ui | ITEM, ITEM_DEFS, isToolItem, maxStackOf, drawItemIcon |
| lights | 112 | blocks | main | LightManager |
| main | 1031 | diag blocks textures world terrain player interaction ui health mob inventory crafting helditem mining sfx drops farming building chapter structure npc dialog quests cutscene save steam-adapter sky lights explore | — |  |
| mesher | 270 | blocks textures | world | buildChunkGeometry |
| mining | 46 | items | interaction main | FALLBACK_MINING, digTime, dropOf, toolDefOf |
| mob | 292 | blocks terrain | main | FALLBACK_MOB_CONFIG, MobManager |
| npc | 497 | blocks terrain chapter | main | FALLBACK_NPC_DATA, NPCManager |
| player | 135 | blocks | main | Player |
| quests | 111 | — | main | FALLBACK_QUESTS, QuestSystem |
| save | 284 | blocks | main | SAVE_VERSION, MemorySaveAdapter, LocalStorageSaveAdapter, serializeDiffs, parseDiffs, validateSnapshot …(7) |
| sfx | 160 | — | main | SFX |
| sky | 92 | — | main | shichen, CelestialBodies |
| steam-adapter | 131 | — | main | STEAM_ACHIEVEMENTS, hasSteamBridge, SteamCloudSaveAdapter, pickSaveAdapter, platformUnlock |
| structure | 76 | terrain blocks | main | stampStructure |
| terrain | 212 | blocks | explore main mob npc structure world | surfaceHeight, chunkColorBands, generateChunk |
| textures | 551 | blocks | helditem interaction main mesher ui | BAND_PALETTE, BAND_TILES, buildAtlas, buildCrackTextures, drawTileTo |
| ui | 344 | blocks items textures | main | itemName, drawIcon, UI |
| world | 168 | blocks terrain mesher explore | main | World |

外部依赖（importmap CDN）：three
