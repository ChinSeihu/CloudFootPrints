# CHANGELOG

> 压缩版修改履历。这里记录当前仍有参考价值的产品能力、架构变化和重要取舍；已被后续方案完全替代的细碎 UI/实现日志合并到阶段摘要中。
>
> 规则：新增变更优先写“用户可见结果 / 数据或架构影响 / 关键文件”，避免记录每一次微调。稳定决策放 `DECISIONS.md`，排障细节只在必要时保留。

---

## 2026-07-04

### 足迹评论与点赞
- 公开足迹支持点赞和评论，发现页足迹卡片展示互动计数，可展开查看最近评论并直接回复一句。
- `Comment` / `Reaction` 目标从官方活动、用户发帖扩展到 `CheckIn`，足迹互动沿用现有分页评论、回复和点赞服务。
- 社区模拟的日常互动候选加入近期公开足迹，虚拟用户可以按人物口吻评论足迹、回复足迹评论，并对足迹点赞。
- 已应用数据库迁移 `20260704120000_add_checkin_interactions`，新增 `checkInId` 外键、索引和足迹点赞唯一约束。
**主要文件：** `prisma/schema.prisma`, `src/services/comments.ts`, `src/services/reactions.ts`, `src/services/checkins.ts`, `src/services/simulation/social.ts`, `src/components/Recommend/RecommendList.tsx`

---

### 降低角色配饰同质化
- 遥香的丝巾从基础穿搭符号降为偶尔出现的场景化配饰，避免每次 city walk 都像固定造型。
- 美月的帽子从常驻旅行创作者标识降为强日晒户外场景的可选配饰，并移除底层 `baseball_cap` 趋势标签。
- 生图 prompt 把 `Signature accessories` 改为“配饰池”，并明确帽子、丝巾、包、首饰、鞋子都不能成为同一角色的每日制服。
- 修复每日 outfit plan 没有传入首轮生图 prompt 的问题，让分配好的穿搭变化真正生效。
**主要文件：** `src/services/simulation/image.ts`, `src/lib/personas.ts`

---

### 公开虚拟用户足迹
- `publish-demo-checkins.ts` 默认从按月份发布改为发布所有 PersonaV2 demo 用户足迹；仍可用 `--month=YYYY-MM` 限定月份。
- 社区模拟新生成的足迹默认写入 `isPublic: true`，让后续生成内容自动进入地图/发现/相关活动聚合。
- 已执行脚本公开现有 demo 足迹：13 个虚拟用户范围内，682 条隐藏足迹改为公开，公开足迹总数变为 886。

**主要文件：** `scripts/publish-demo-checkins.ts`, `src/services/simulation/engine.ts`

---

### 修复模拟发帖不出现在发现页
- 推荐页过期过滤改为只作用于官方活动；用户发帖 `Post(sourceType="USER")` 不再因 `startTime` 早于当前时间被当作过期活动过滤掉。
- 活动查询合并官方活动与用户发帖时，不再让 500 条总量截断把用户发帖挤掉；返回上限会为用户发帖额外留出空间。
- 推荐页向前端补充传递 `createdAt/updatedAt`，发现页“最新”排序可以按真实发布时间排序。
- 发现页默认切到“最新”，并让未实现的关注/附近排序也以发布时间为主，避免无图模拟发帖被有图旧内容压到首页切片之外。
- 推荐页 ISR 从 1 小时缩短到 5 分钟，降低模拟发帖写入后发现页长时间看不到新内容的概率。

**主要文件：** `src/services/events.ts`, `src/app/recommend/page.tsx`, `src/components/Recommend/RecommendList.tsx`

---

### 精确化模拟发帖与足迹定位
- 足迹地点选择不再只按 activity 随机加权，改为综合 `activity`、`areaHint`、正文 `note`、`imageSpec` 场景文字和候选地点名称打分；有明确匹配时取最高分，只有完全无线索时才使用兜底选择。
- 足迹坐标抖动从百米级缩小到更贴近地点本身的二三十米级，保留自然感但避免偏到不相关街区。
- 模拟普通发帖不再从人物地点池随机落点，改为根据标题、正文、分类和地点候选匹配 `venueName/lat/lng`。
- 生活决策 prompt 和社交 prompt 都加入地点候选与一致性规则，减少“内容写 A 地，坐标落 B 地”的偏差。

**主要文件：** `src/services/simulation/decide.ts`, `src/services/simulation/engine.ts`, `src/services/simulation/social.ts`

---

### 强化人物穿搭、相机风格与足迹双图
- 模拟生图新增人物级视觉 profile：每个 PersonaV2 账户都有更明确的衣橱胶囊、色彩、配饰、禁用风格和相机/滤镜气质。
- 穿搭 prompt 强化 2026 东京年轻人真实街头穿搭，加入 sheer/mesh、nylon、cargo、balloon skirt、compact shoulder bag、Mary Janes、trail sneakers、utility vest 等更现代但可穿出门的元素。
- 美月重点改为 2026 东京旅行创作者/轻户外 city trekking 风格，使用 utility vest、sun shirt、nylon skirt、wide cargo pants、trail sneakers、camera sling bag 等可步行元素；帽子只作为强日晒户外场景的低频可选配饰，并避免甜美蕾丝或 clean-girl 针织套装同质化。
- 全局 Kodak/Fuji 混合滤镜改为人物级 camera profile，例如さくら偏 Fujifilm Classic Chrome，美咲偏 Kodak Gold 胶片咖啡馆，美月偏 Nikon Zfc 清透旅行 JPEG。
- 足迹图片生成支持双图策略：如果第一张图主角不出镜，会用同一天同套 outfit 追加一张自然人物出镜补图，写入 `photoUrls`。

**主要文件：** `src/services/simulation/image.ts`, `src/services/simulation/engine.ts`

---

### 社区模拟加入发帖、评论与回复
- 新增模拟社交层：每日生活/足迹推演后，会让 PersonaV2 虚拟账户按人物语气生成普通社区发帖、评论、回复和少量互动反应。
- 普通发帖写入 `Post`，不再把所有公开内容都挤进足迹；评论和回复写入现有 `Comment`，可落在官方活动或用户帖子上。
- 社交层参考人物兴趣、目标、写作口吻、近期记忆、近期发言、候选活动/帖子和评论线程，避免统一客服式语气。
- 社交层具备当天幂等保护：当天已有 demo 社交内容时跳过，避免重复刷屏；`--dry` 只做安全预览，不调 LLM、不写库。
- `sim-run` 输出增加社交统计，显示发帖、评论、回复数量和预览 notes。

**主要文件：** `src/services/simulation/social.ts`, `src/services/simulation/engine.ts`, `scripts/sim-run.ts`

---

## 2026-07-01

### 推荐页与发现流收敛
- 推荐页重构为“活动 / 发现”两种模式：活动侧包含官方精选、快捷分类、热门活动和个性化推荐；发现侧承载用户发帖、公开足迹和同日心情统计。
- 用户足迹从小卡片扩展为更接近社区 feed 的卡片形态，支持头像、心情、正文展开、多图预览、全屏看图和“查看全部”分区。
- 移动端推荐页和详情页整体收紧：头部、筛选、卡片、图片区、操作区都改为更适合小屏的密度。
- “为你推荐”优先使用 LLM daily picks，之后再按时间、互动、图片完整度和可信度回退。
- Demo 足迹发布维护脚本改为按东京月份发布，默认处理 `2026-06`。

### 抓取去重与时间修复
- 抓取入库前先过滤数据库与同批重复项，减少 LLM 分类/摘要的浪费。
- 当旧重复记录缺少具体时间或只有午夜占位时，新抓取候选可回填更精确的开始/结束时间。
- 抽取统计新增 `updated`，便于观察本次运行修复了多少旧数据。

**主要文件：** `src/components/Recommend/RecommendList.tsx`, `src/components/Recommend/EventDetail.tsx`, `src/services/extraction/index.ts`, `src/services/extraction/ingest.ts`, `scripts/publish-demo-checkins.ts`, `.github/workflows/maintenance.yml`

---

## 2026-06-30

### 活动详情与社区互动升级
- 官方活动详情重做为图像优先的沉浸式详情页，用户发帖详情改为独立的社交帖子布局。
- 详情页使用真实互动数据，不再展示占位点赞、收藏、评论或想去数。
- 评论改为分批加载：根评论 10 条一批，回复默认显示 3 条并可继续加载。
- 官方活动开始保存并展示更有意义的 `tags`，代替旧的填充式统计信息。
- 用户发帖详情加入真实关注动作，连接到新的关注系统。

### 关注关系
- 新增 `UserFollow`，支持关注/取关、粉丝/关注列表、互相关注标识、回关与取消关注确认。
- Demo PersonaV2 好友关系会同步为互相关注；模拟内部 `Relationship` 仍保持独立。

### 模拟图片再生成
- 用户帖子和足迹新增 `imageSpec`，保存原始结构化生图意图。
- Demo PersonaV2 内容支持在编辑弹窗内再生成图片，并即时预览/回写列表。
- 社区模拟创建足迹时写入图片规格，后续再生成不再只靠文本反推。

### Vercel 观测
- App Router 根布局挂载 Vercel Web Analytics 与 Speed Insights，生产部署后采集访问与性能数据。

**主要文件：** `prisma/schema.prisma`, `src/components/Recommend/EventDetail.tsx`, `src/components/Me/EditDialogs.tsx`, `src/components/Me/MeView.tsx`, `src/services/follows.ts`, `src/services/users.ts`, `src/services/comments.ts`, `src/services/simulation/*`, `src/app/layout.tsx`, `package.json`

---

## 2026-06-27

### 地图、弹窗与附近内容
- 地图活动、用户发帖、足迹、景点、美食弹窗统一为更稳定的卡片体系，关闭按钮、操作区和详情入口减少碰撞。
- 活动弹窗加入详情 / 发帖 / 足迹分区，可直接查看相关用户内容并进入发布。
- 官方活动、用户发帖、混合聚合点视觉重新整理：普通聚合保留数字圆，混合聚合使用分段环，单个用户发帖使用更醒目的相机标记。
- 附近活动卡片在无图时显示设计过的占位图，不再留下空图片区。
- 地图筛选、附近 sheet、锚点、路线提示和收藏/导游动作做了多轮收敛，最终目标是减少遮挡、减少误触、提升小屏可读性。

### 抓取时间继续修复
- LLM 抽取提示和入库 fallback 继续强化时间捕获，减少活动被错误存成午夜。

**主要文件：** `src/components/Map/MapExplorer.tsx`, `src/components/Map/Filters.tsx`, `src/components/Map/PopularCard.tsx`, `src/app/api/events/[id]/related/route.ts`, `src/services/checkins.ts`, `src/lib/llm.ts`, `src/services/extraction/ingest.ts`

---

## 2026-06-26

### 页面结构与个人页
- 地图、日历、推荐页完成一轮大改版：推荐页引入精选轮播和更强的活动发现结构，日历页强化红日/热度，地图页强化探索与底部内容面板。
- 个人页持续收紧为更像真实社区资料页的结构：资料卡、照片墙、时间线、心情标签、分组信息和 PersonaV2 头像裁剪逐步统一。
- 足迹表单移除手动时间输入，降低发布成本。

### PersonaV2 与模拟内容
- Demo 用户迁移到 PersonaV2 角色体系，登录页 demo 用户改为数据库读取。
- 模拟配图规则加强：提高真人出镜比例，修正过强第一人称视角，收紧 QA 与胶片/写实要求。
- PersonaV2 迁移后，`sim-run` 调用链、人物头像、角色文档和数据库 demo 用户保持一致。

**主要文件：** `src/components/Map/*`, `src/components/Recommend/*`, `src/components/Me/*`, `src/lib/personas.ts`, `docs/demo-personas.md`, `scripts/*`

---

## 2026-06-23

### 社区模拟 V7 成型
- 建立记忆驱动社区模拟：人物状态、关系、世界状态、记忆、每日决策、内容产出、关系维护和记忆压缩形成闭环。
- 加入系统外熟人 cast、动态签名/状态、情绪回归、重大人生事件，让 demo 社区从静态测试数据转向持续演化。
- 配图管线打通：先由 LLM 写详细英文场景 prompt，再附加写实、视角、表情、人物一致性规则；失败时 fallback，不阻断模拟。
- Agnes 图像 provider 端到端接入，图片持久化到 Cloudinary。
- 使用 `public/person.png` 裁出 12 张人物参考图，通过图参锁脸；`scripts/sim-reset.ts` 提供 demo 内容清空重灌流程。

**主要文件：** `src/services/simulation/*`, `src/lib/personas.ts`, `scripts/sim-run.ts`, `scripts/sim-inspect.ts`, `scripts/sim-reset.ts`, `scripts/crop-refs.ts`, `public/person.png`, `public/refs/*`, `docs/demo-personas.md`, `docs/Agent_Architecture.md`

---

## 2026-06-22

### 推荐与足迹社交化
- 推荐页顶部从传统标题页转向社区 App 风格，活动/发现入口、搜索/筛选、用户内容和心情表达开始成为主线。
- 官方活动与个人内容在地图和推荐页明确区分。
- 足迹从“打卡记录”升级为带图片、心情值、统计分组、弹窗、轨迹线和地图定位的公开内容。
- 测试账号数据真人化，并迁移更多图片到 Cloudinary。

**主要文件：** `src/components/Recommend/*`, `src/components/Map/*`, `src/components/Me/*`, `src/services/checkins.ts`, `scripts/*`

---

## 2026-06-20

### 交通与导航
- 换乘导航从车站扩展到活动、店铺和景点，坐标端点会接驳到最近车站。
- 基于 OSM 静态车站/线路图构建连通图路由，提供推荐路线和少换乘方案；不做时刻表级 RAPTOR。
- 路线面板支持起点可改、收起、逐站时刻、导航时隐藏干扰活动。
- 用户头像、分享、最后登录时间等社交基础体验补齐。

**主要文件：** `src/services/routePlanner.ts`, `src/services/odpt.ts`, `src/components/Map/RoutePanel.tsx`, `src/components/Map/LinePanel.tsx`, `public/stations.json`, `public/lines.json`

---

## 2026-06-19

### ODPT 时刻表与线路详情
- 车站卡片线路入口合并为线路详情面板：顶部选择发车时刻，主体展示逐站时刻，并标记当前站。
- ODPT 接入站点时刻表、列车时刻、运行情况和部分实时列车位置；覆盖不足时显示明确说明。
- 时刻表请求加入缓存与刷新能力，方向和站点点击交互更稳定。

**主要文件：** `src/services/odpt.ts`, `src/app/api/train-timetable/route.ts`, `src/app/api/train-positions/route.ts`, `src/components/Map/LinePanel.tsx`, `src/components/Map/TrainTimetablePanel.tsx`

---

## 2026-06-17 至 2026-06-18

### 官方活动与用户发帖分表
- 官方抓取活动保留在 `Event`，用户发帖迁移到 `Post`，前端通过统一 DTO 继续按一个活动对象消费。
- 评论、反应、收藏、报名、详情读取和地图/推荐列表合并读取两类内容。
- 地图点进推荐页时，如果列表中没有命中活动，会按 id 拉详情再打开，解决过期或超范围活动无法展开的问题。

### CI 与部署
- GitHub Actions 每日抓取环境升级到 Node 22，修复依赖安装失败。

**主要文件：** `prisma/schema.prisma`, `scripts/split-posts.ts`, `src/services/events.ts`, `src/app/api/events/[id]/route.ts`, `.github/workflows/extract.yml`

---

## 2026-06-16

### AI 导游、去重与交通图层
- AI 导游接入本站活动库，回答今天/近期活动时注入东京当前时间，并优先使用真实活动上下文。
- 导游回答不暴露后端/系统术语；每轮都提供后续追问建议，提到的活动可点击进入详情。
- 抓取与导游推荐都加入重复控制，减少同一活动反复出现。
- 数据扩展到首都圈四县：东京、神奈川、埼玉、千叶。
- 地图新增电车/地铁站层，车站点击可看线路和简介；地图控件去 emoji 并调整布局，避免 FAB 遮挡。
- 美食层从手工精选扩展到 Hot Pepper 候选池，OSM 美食试点退居广覆盖参考。

**主要文件：** `src/lib/llm.ts`, `src/services/guide*`, `src/components/Guide/*`, `src/components/Map/*`, `scripts/enrich-station-lines.ts`, `public/stations.json`, `public/lines.json`, `src/lib/foodSpots.ts`

---

## 2026-06-15

### 地图内容扩展
- 美食从少量精选扩展到 23 区覆盖，使用 Hot Pepper 候选池与人工精选混合；有照片的店铺显示相机标识。
- 景点卡片加入真实维基图片和 Lightbox。
- 活动标签在高缩放级别显示，地图视觉整体降噪。
- 抓取管线加入 LLM 一句话摘要，存入 `Event.summary`，用于地图和推荐的短文案。
- 报名、发帖/打卡编辑、活动详情和个人页能力进一步补齐。

**主要文件：** `src/lib/foodSpots.ts`, `src/services/extraction/*`, `src/components/Map/*`, `src/components/Recommend/*`, `src/components/Me/*`

---

## 2026-06-14

### 数据源、加载与交互
- 新增 Walkerplus 体育和演唱会等分类源。
- 推荐、日历、个人页加入懒加载、ISR 缓存和骨架屏。
- 去掉手动刷新，改为 GitHub Actions 每日定时抓取。
- 多图上传、图片放大、楼中楼回复、消息已读/未读、地图定位消息等基础社区能力上线。
- 删除确认从 `window.confirm` 改为更可靠的自定义确认，避免部分 WebView 误删。

**主要文件：** `src/services/extraction/*`, `.github/workflows/extract.yml`, `src/components/Recommend/*`, `src/components/Calendar/*`, `src/components/Me/*`, `src/components/Map/*`

---

## 2026-06-13

### 账号、互动与基础社区
- 本地账号系统上线：`User`、bcrypt、JWT httpOnly cookie、登录态和鉴权。
- 收藏/点赞、评论/回复/删除、评论作者展示、测试账号一键登录上线。
- 推荐详情全屏化，发帖/打卡表单现代化，发帖和打卡支持时间与图片。
- 日历增加节假日、活动数量、长期活动展期中显示。
- 地图加入地标/公园、柔和马卡龙底图、人气活动卡片、聚合呼吸动效和更完整的锚点体验。
- AI 导游基础入口上线。

**主要文件：** `src/lib/auth.ts`, `src/services/reactions.ts`, `src/services/comments.ts`, `src/components/Recommend/EventDetail.tsx`, `src/components/Map/*`, `src/components/Calendar/*`, `src/components/Guide/*`

---

## 2026-06-12

### 真实活动抓取与发布能力
- 接入 Walkerplus JSON-LD 与 Jalan，逐详情页抓取，保留来源详情页 URL，使用 GSI 地理编码和东京边界校验。
- 支持分页、LLM 分类、活动图片、时间范围筛选、地图区分打卡/发帖。
- Cloudinary 图床配置完成：客户端压缩、unsigned upload、图片 URL 入库。
- 构建流程加入 `prisma generate`，改善 CI/部署/换机稳定性。
- README 与协作工作流重写，跨设备同步问题修复。

**主要文件：** `src/services/extraction/*`, `src/lib/image.ts`, `src/components/Map/*`, `src/components/Recommend/*`, `README.md`, `package.json`

---

## 2026-06-09

### 项目初始化与第一版地图
- 创建 Next.js + Prisma + MapLibre 项目，完成活动地图、聚合 marker、打卡/发帖删除、我的筛选、天气面板、活动日历、地址复制等第一版能力。
- 强制亮色主题，建立同位置堆叠卡片和现代化地图标记。
- 修复依赖安装与 Turbopack 启动问题，建立早期本地开发路径。

**主要文件：** `src/app/*`, `src/components/Map/*`, `src/components/Calendar/*`, `prisma/schema.prisma`, `package.json`
