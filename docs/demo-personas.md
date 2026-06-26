# Tokyo Event Map 社区人物模拟手册 V2

本手册对应 `src/lib/personas.ts` 的 `PersonaV2`。后续模拟、出图、状态刷新和记忆压缩都以 `PersonaV2` 为标准，不再使用旧版 `Persona` 的 `job / home / roam / conflict / refIndex` 字段。

## 核心目标

模拟一组真实生活在东京及周边的年轻人。内容生成时优先级始终是：

```text
人生状态 > 情绪变化 > 当下事件 > 兴趣爱好
```

兴趣只是生活的一部分，不要把角色写成“展览机器”“咖啡机器”“Live House 机器”。一个人的工作压力、天气、身体状态、朋友影响、独处需求和偶发事件，都应该能改变当天是否出门、去哪里、写什么。

## PersonaV2 字段

`PersonaV2` 是结构化事实源，主要字段包括：

- `id`: 角色 ID，例如 `C01`，同时对应 `public/refs/01.png`。
- `username / usernameKana`: 展示名与假名。
- `age / gender / occupation / archetype`: 基础身份。
- `appearance / photoSkill`: 外观与摄影能力，供 Image Agent 使用。
- `homeArea / frequentAreas / explorationAreas`: 生活据点与移动范围。
- `mobilityProfile`: 通勤方式、平日/周末半径、探索概率、朋友影响。
- `personality / socialProfile / emotionBaseline`: 决策和情绪回归的基础参数。
- `lifeStage / coreConflict`: 长期人生状态与核心张力。
- `interests`: `core / secondary / hidden / avoid` 四层兴趣。
- `weekendBehavior / spendingStyle / goals`: 周末行为、消费偏好和目标。
- `friends / acquaintances`: 使用角色 ID 表示关系，例如 `C02`。
- `voice`: 结构化口吻，不直接当字符串使用。
- `dynamicContext`: 当前压力、当前目标、近期记忆和计划。

## V2 派生函数

模拟链路不要直接拼旧字段，统一使用 `src/lib/personas.ts` 的派生函数：

- `personaGoals(persona)`: 把短期目标、长期目标和当前目标合并为 `string[]`，用于 `CharacterState.goals`。
- `personaLifeStageText(persona)`: 把结构化人生阶段格式化为可写入 `CharacterState.lifeStage` 的字符串。
- `personaInterestList(persona)`: 合并核心、次级和隐藏兴趣，用于 LLM prompt。
- `personaVoiceText(persona)`: 把结构化口吻转成 prompt 文本。
- `personaSpots(persona)`: 返回可打卡坐标候选点，用于 `sim-run.ts` 调用链。
- `personaRefIndex(persona)`: 从 `Cxx` 推导 `public/refs/xx.png`。
- `friendPairs()`: 把 `friends` 中的角色 ID 转成用户名关系对。

数据库里的 `CharacterState.goals` 仍是 `string[]`，`lifeStage` 仍是 `string?`。它们是模拟状态快照，不是人物模型本体。

## 当前 13 人

| ID | 账号 | 年龄 | 职业 | Archetype | 据点 |
|---|---|---:|---|---|---|
| C01 | さくら | 28 | 出版社编辑 | 文艺观察系 | 渋谷 |
| C02 | 美咲 | 29 | 自由平面设计师 | 设计咖啡生活 | 中目黒 |
| C03 | 遥 | 30 | 品牌内容编辑 | 温柔系生活记录博主 | 三軒茶屋 |
| C04 | 麻衣 | 24 | 广告公司职员 | 都市白领 | 表参道 |
| C05 | 遥香 | 28 | 内容创作者 | City Walk 博主 | 蔵前 |
| C06 | 美月 | 27 | 旅行内容创作者 | 旅行博主 | 自由が丘 |
| C07 | 凛 | 30 | 油画教师 | 疗愈生活博主 | 自由が丘 |
| C08 | 湊 | 26 | 音乐内容创作者 | Live House 博主 | 下北沢 |
| C09 | ゆい | 31 | 古着生活博主 | 古着生活博主 | 吉祥寺 |
| C10 | たけし | 35 | 摄影师 | 东京街拍摄影博主 | 浅草 |
| C11 | 林雨晴 | 23 | 大学院生 | 中国留学生生活博主 | 高田馬場 |
| C12 | 莉子 | 28 | SNS运营 | 宠物生活博主 | 代々木 |
| C13 | 真理 | 27 | 自由撰稿人 | 甜品探店博主 | 恵比寿 |

## sim-run 调用链

入口：

```bash
npx tsx scripts/sim-run.ts
npx tsx scripts/sim-run.ts --date=2026-06-20
npx tsx scripts/sim-run.ts --from=2026-02-01 --to=2026-06-22
npx tsx scripts/sim-run.ts --only=さくら,美咲
npx tsx scripts/sim-run.ts --date=2026-06-20 --dry
```

主链路：

```text
scripts/sim-run.ts
  -> src/services/simulation/engine.ts
    -> personaOf / personaGoals / personaLifeStageText / personaSpots
    -> decideDay()
    -> createCheckin()
    -> generateCheckinImage()
    -> maintenance: relationships / community / memory / signature / lifeEvents
```

`engine.ts` 的参与概率使用 `socialProfile.socialNeed` 与 `personality.extraversion`，地点来自 `personaSpots()`，不再读取旧的 `home`/`roam`。

`decide.ts` 的 prompt 使用：

- `occupation`
- `coreConflict`
- `personaInterestList()`
- `personaVoiceText()`
- `goals`
- `lifeStage`
- `personaSpots()` 提供的地点列表

`sim-init.ts` 初始化 `CharacterState` 时会把 V2 的结构化目标和人生阶段写成当前数据库字段需要的形状。

## 视觉参考图

视觉设定源：

```text
public/personV2.png
```

单人参考图：

```text
public/refs/01.png ... public/refs/13.png
```

裁剪脚本：

```bash
npx tsx scripts/crop-refs.ts
```

Image Agent 使用 `personaRefIndex()` 从 `C01` 到 `C13` 自动找到对应参考图。C13 已有 `public/refs/13.png`。

## 图片生成规则

CheckIn 约 90% 可以配图，但不要强迫每条内容都有人脸。优先级：

```text
环境 > 物品 > 活动现场 > 人物
```

适合配图：

- 美食、咖啡、甜品
- 演出、展览、活动现场
- 公园、河边、夜景、旅行
- 宠物友好场景
- 有画面感的日常瞬间

不适合强制配图：

- 加班、发呆、纯情绪记录
- 私密对话
- 没有画面主体的内心活动

人物出镜时必须保持 `appearance` 与参考图一致，但服装、包、鞋、配饰要随季节、天气和活动自然变化。

## 内容规则

`CheckIn` 必须像真实 SNS 足迹：

- 第一人称。
- 50 到 150 字左右。
- 写一个具体瞬间，不写景点介绍。
- 情绪允许低落、疲惫、孤独、犹豫，但避免极端绝望或自残内容。
- 可以出现系统外熟人，并写入 `people` 维持连续性。
- 地点只能从给定 spot 列表中选。

长期题材比例建议：

```text
日常生活      40%
工作 / 学习    20%
兴趣爱好      15%
社交活动      15%
随机事件      10%
```

## 动态维护

- `community.ts`: 每日把情绪向 `emotionBaseline` 回归；每周唤醒长期沉默角色。
- `relationships.ts`: 根据同日活跃角色维护弱连接强度。
- `memory.ts`: 压缩旧 `EVENT` 记忆为 `SUMMARY`。
- `signature.ts`: 根据近期记忆刷新 `status` 和 `signature`。
- `lifeEvents.ts`: 每月低概率触发可信的人生事件。

这些模块都应消费 `PersonaV2` 或 V2 派生函数。新增人物字段时，优先扩展派生函数，而不是在各服务里散落字段拼接逻辑。
