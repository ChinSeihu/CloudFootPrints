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

## 配图规则

### 目标

配图应让用户感觉：

> 真的有一群生活在东京的年轻人，正在记录自己的日常。

而不是：

> AI 正在生成东京生活照片。

整体风格偏 Threads、Instagram、BeReal、小红书日常记录，而非商业广告、摄影作品集、旅游宣传图或 AI 海报。

### 人物一致性

人物外观一致性基准：

```text
public/personV2.png
public/refs/01.png ... public/refs/13.png
```

对应 `src/lib/personas.ts` 中的：

- `appearance`
- `photoSkill`
- `personaRefIndex()`

必须长期保持一致：

- 脸部特征
- 发型
- 发色
- 身高
- 体型
- 性别气质

禁止：

- 换脸
- 发型漂移
- 身高变化
- 身材变化

可以根据场景动态变化：

- 上衣
- 外套
- 裤子
- 裙子
- 鞋子
- 包
- 配饰

原则：同一个人不等于永远穿同一套衣服。穿搭应符合季节、天气、活动内容和东京年轻人的日常习惯。

### 角色摄影能力

来源：`photoSkill`

`pro`：

- 代表：C10 たけし
- 允许主观镜头、客观摄影、摄影作品。

`hobby`：

- 代表：C05 遥香、C06 美月、C07 凛、C09 ゆい、C11 林雨晴、C13 真理
- 默认主观镜头。
- 仅在特意拍照、摄影创作、认真出片时允许客观摄影。

`casual`：

- 其余人物。
- 日常照片优先 POV、自拍、朋友帮拍。
- 避免专业摄影感。

### 图片主体类型

先决定图片拍的是什么，再决定如何拍。

`ENVIRONMENT`：环境

- 例如东京街景、夜景、河边、公园、演唱会舞台、花火大会。
- 人物可不存在。

`OBJECT`：物品

- 例如咖啡、拉面、茶泡饭、车票、黑胶唱片、电脑桌、甜品、宠物用品。
- 人物可不存在。

`SELF`：发帖人本人

- 例如自拍、镜子自拍。

`SELF_AND_FRIENDS`：发帖人与朋友

- 例如聚餐、合照、出游。

`FRIENDS`：朋友

- 发帖人不一定出现。

`OBSERVED_PEOPLE`：观察到的人

- 例如情侣、路人、老夫妻、排队的人群。
- 重要：`OBSERVED_PEOPLE` 不等于发帖人，不要让用户误认为图片中的人物是发帖账号本人。

### ContainsPoster

生成图片时必须明确：

```ts
containsPoster: boolean
```

`true`：图片中包含发帖人，例如自拍、合照、朋友帮拍。

`false`：图片中不包含发帖人，例如咖啡、风景、路人、演唱会、夜景。

### 镜头类型

Image Agent 应优先选择以下镜头。

`POV_HAND`：主观镜头

- 手里的咖啡
- 手里的车票
- 手里的烟花棒

`POV_FOOD`：主观餐桌视角

- 拉面
- 居酒屋
- 茶泡饭
- 甜品

`POV_STREET`：主观街景

- 散步
- 回家路上
- 逛街

`POV_STAGE`：观众席视角

- Live
- 演唱会
- 舞台剧

`POV_WALK`：步行视角

- 目黑川
- 吉祥寺
- 下北泽

`SELFIE`：自拍

- 前置摄像头
- 手持手机
- 自然表情
- 禁止网红摆拍

`GROUP_SELFIE`：多人自拍

- 朋友挤进镜头
- 轻微构图混乱
- 有真实感

`FRIEND_TOOK`：朋友帮拍

- 自然状态
- 不看镜头
- 不摆 Pose
- 推荐用于聚餐、野餐、出游。

`PHOTO_WORK`：摄影作品

- 仅 `pro` 与 `hobby` 允许使用。

### 出镜优先级

普通动态建议：

```text
ENVIRONMENT       40%
OBJECT            30%
SELF              15%
SELF_AND_FRIENDS  10%
FRIENDS            3%
OBSERVED_PEOPLE    2%
```

原则：不要每条动态都有人脸。东京年轻人的真实动态里，大量内容是食物、街景、演出、天空、河边、店铺，而不是自拍。

### 拍摄意图

图片不仅要描述场景，还要体现为什么拍。

示例：

- 午餐：`showing today's lunch`
- 演唱会：`wanting to remember the moment`
- 散步：`capturing the atmosphere of the evening`
- 旅行：`saving memories from the trip`
- 下班：`sharing a small moment from today`

### 东京地点库

优先具体地点，避免笼统写 `Tokyo cafe` 或 `Tokyo street`。

推荐地点词：

- Shibuya
- Harajuku
- Shimokitazawa
- Ebisu
- Nakameguro
- Kichijoji
- Koenji
- Jiyugaoka
- Asakusa
- Shinjuku
- Yoyogi Park
- Meguro River
- Daikanyama
- Kuramae
- Takadanobaba
- Omotesando

优先写 `small cafe in Shimokitazawa`，而不是 `Tokyo cafe`。

### 不完美细节库

可随机加入：

- `slightly imperfect composition`
- `partially cropped subject`
- `subtle motion blur`
- `slightly tilted horizon`
- `people walking through frame`
- `table clutter`
- `social media compression`
- `smartphone auto exposure`
- `imperfect framing`
- `captured in a hurry`

避免：

- 完美构图
- 完美对称
- 完美打光

### 配图频率

`CheckIn`：约 90% 配图。

适合：

- 美食
- 演出
- 温泉
- 海边
- 公园
- 节日活动
- 宠物友好场景
- 有画面感的日常瞬间

不强制：

- 加班
- 洗衣
- 发呆
- 纯情绪记录
- 私密对话

`Post`：尽量配 1 张封面图，必须与活动内容匹配。

### 基础 Prompt

统一风格：

```text
Japanese lifestyle photography,
authentic daily life in Tokyo,

casual smartphone snapshot,
captured casually,

unposed moment,
ordinary happiness,

natural lighting,

slightly imperfect composition,

realistic smartphone camera quality,

social media photo,

Kodak Portra 400 color tone,
Fujifilm Superia muted greens and soft contrast,
subtle film grain,
gentle highlight halation,
mild lens softness,

atmospheric storytelling,

not professional photography,
not commercial photography,
not advertisement
```

质检补充：
- 手部 / 手指 / 手腕 / 胳膊 / 身体比例有明显畸形时，直接判为不合格并重生成。
- 出现塑料皮肤、蜡像脸、过度磨皮、过度锐化、HDR 过强、摄影棚光、网红大片感时，直接判为不合格。
- 允许轻微虚焦、胶片颗粒、曝光不完美、构图不完美；这些比“完美高清”更像真实生活照。
- 第一人称主角拍摄时，画面里最多出现一只手；除非明确自拍、镜子、定时器、三脚架或朋友拍摄，否则两只手同时清晰入镜会显得不合理。
- 如果手部不是画面重点，prompt 应避免把手部作为清晰主体；如果必须出现手，需强调 natural hands and anatomy。
- 重生成 prompt 应补充 documentary smartphone photo、subtle 35mm film grain、muted film colors、imperfect casual framing。

### 最终原则

除非内容明确需要人物出镜，否则优先：

```text
环境 > 物品 > 活动现场 > 人物
```

不要因为动态属于某个角色，就强制让角色出现在画面中。人物存在于生活里，不一定存在于镜头里。

第一人称足迹尤其要避免“他拍误区”：主角独自行动时，图片默认应像主角自己拍到的环境、物品、餐桌、票根、街景、舞台或窗外，而不是第三者拍主角本人。只有文案明确自拍、朋友同行、合照、朋友帮拍、镜中倒影、背影或被拍瞬间时，才让发帖人明显出镜。

### 防 AI 味规则

如果某角色连续 5 条内容围绕同一兴趣，下一条必须优先生成：

- 工作
- 身体状态
- 天气
- 社交
- 家务
- 偶然事件

工作相关话题的优先级也应该降低，没有人喜欢天天分享工作相关的。任何角色都不能变成“展览机器人 / 咖啡机器人 / Live 机器人”。

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
