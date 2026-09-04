# 云迹东京 IP 原稿

这里保存云足 Kumoashi 与路灵 Michiru 的完整角色设定图。每张 PNG 均包含主立绘和一组动作参考，供界面设计、宣传物料和后续矢量拆分使用。

## 资产导航

- `menu-user-v4.png` — 当前菜单素材，用户直接提供，原样保存；按路灵男、路灵女、云足男、云足女四行映射，列为地图、日历、探索、个人。替代 V3 图集，旧素材仅归档。

- `character-design-reference-2026-09-04.png` — 用户提供的新版完整角色设计原稿，原样保存，后续设计以此为参考。
- `menu-design-v3-transparent.png` — 当前使用的四角色 × 四功能透明菜单图集；菜单、个人页角色选择及共用该组件的提示同步更新。
- `menu-design-v3.png` — 生成中间稿（棋盘格为实色背景），仅归档，不用于界面。
- `MENU-V3-PROMPTS.md` — 本轮内置 imagegen 提示词与角色映射说明。旧菜单素材保留供回退。

- `menu-kumoashi.png` — 云足·晴空，同一个云足角色对应四种功能道具。
- `menu-kumoashi-sakura.png` — 云足·樱梦，玫粉/紫色明暗层次的云足角色。
- `menu-michiru.png` — 路灵·远行，同一个路灵角色对应四种功能道具。
- `menu-michiru-lilac.png` — 路灵·花语，明亮粉紫的路灵角色。
- `menu-standard-v2.png`、`menu-feminine-v2.png` — 本轮设计的混搭中间稿，仅归档，不再用于菜单。
- `MENU-PROMPTS.md` — 第二版菜单图的生成与透明背景处理提示词记录。

- `kumoashi-standard.png` — 云足标准版；承担发现生活、社区陪伴、分享与足迹成功反馈。
- `kumoashi-feminine.png` — 云足女性版最终稿；加强梅紫轮廓、玫红重点色与粉紫层次。
- `michiru-standard.png` — 路灵标准版；承担地图导航、路线规划、位置提示与到达引导。
- `michiru-feminine.png` — 路灵女性版最终稿；使用明亮粉紫、薄荷绿路线色和珊瑚色路点，避免大面积暗色。
- `nav-standard.png` — 标准版真实 IP 导航条带；从左至右为地图、日历、发现、个人四个姿态。
- `nav-feminine.png` — 女性版真实 IP 导航条带；位置顺序与标准版一致，使用真正透明背景。

## 使用约定

- 完整原稿用于设计参考；底部菜单使用四张按角色命名的 `menu-*.png`，一套内不混用角色。旧 `nav-*.png` 和混搭 `menu-*-v2.png` 仅留作历史设计参考。
- 个人页显示四个 IP 名字，选择即时作用于整个底栏；使用 `tem_mascot_identity` 保存，旧 `tem_mascot_variant` 仅作为首次读取兼容来源。
- 生成条带的角色位置不完全等宽，实际取图区域记录在 `Mascot.tsx` 的 `MENU_SHEETS`；调整资产时同步核对区域与白底实际尺寸效果。
- `src/components/Mascot/Mascot.tsx` 负责导航条带定位和角色偏好切换；共用足印等纯符号场景仍可使用矢量标记。
- 标准版与女性版需要保持相同角色职责和基础轮廓；调整动作、服装或发型时，不应改变角色身份。
- 新增导出图时使用可读文件名，不要用生成任务 ID 覆盖这些最终稿。
