# 关键决策记录

> 记录已确认的、不会轻易变动的设计/技术决策，供换设备或新对话时快速重建上下文。

---

## 架构

- **薄 route handler + 厚 service 层**：领域逻辑全在 `src/services/*`，route handler 只解析参数/调 service/返回响应。目的：为未来迁移 Python 留门。
- **数据库即接缝**：未来 Python 服务接入时，以 DB + HTTP/JSON 为边界，不提前搭抽象层。
- **用户系统（已接入本地账号）**：`User` 表 + bcrypt 口令哈希 + jose JWT(httpOnly cookie)，`lib/auth.ts` 提供会话。打卡/发帖/删除按真实 `userId` 鉴权；未登录不可打卡/发帖。**service 不读 cookie**——route 取 `getCurrentUserId()` 后传入，避免脱离 request context（如 extract 脚本）。旧 `userId="me"` 历史数据保留不迁移。前端登录态用 `AuthContext`（layout 挂载）。`AUTH_SECRET` 签名密钥（本地有开发默认）。

## 技术栈（锁定，不随意替换）

- Next.js 16（App Router）+ TypeScript + Tailwind v4
- Prisma 7（pg driver adapter）+ PostgreSQL
- MapLibre GL JS + CARTO Positron 底图
- 数据提取：`claude-haiku-4-5`（tool use 结构化输出）+ 国土地理院 GSI 地理编码
- 天气：Open-Meteo（免费、无需 API key），服务端 `services/weather.ts` 拉取后转 DTO，组件只认 `WeatherForecast`

## 地图渲染

- **活动 marker 用 GeoJSON source + MapLibre cluster 图层**（非 DOM marker），原因：原生支持聚合/展开，性能好。
  - 聚合圆：实心蓝（#2563eb）+ 白边 + 外层半透明蓝光晕（halo 单独一层垫在下方）+ 白字数量
  - 单点：分类色填充圆（radius 9）+ 白色描边（2.5px）
- **打卡 marker 同样用 GeoJSON cluster 图层**，琥珀色（#f59e0b）+ 同款光晕
- **底图风格可切换（标准 / 柔和）**：`lib/mapTheme.ts` 对现有矢量图层**就地重着色**（`setPaintProperty`），**不调 `map.setStyle()`**——否则会清掉聚合/打卡等自定义 source/layer，需在 `style.load` 重新挂载，复杂且易错。柔和 = 马卡龙水彩（暖奶油陆地/柔蓝水/柔绿园/白路）；切回标准从记录的原始 paint 还原。选择存 `localStorage`，默认柔和。**插画风固定底图（满地手绘樱花/树 + 3D 地标）不做**：需美术出图/定制瓦片、失去任意缩放与地理精度，超出 v1。
- **人气活动卡片**：按球面距离取最近活动（纯前端）。基准 = **用户点击地图落的「探索锚点」**（玫红脉冲 DOM marker，空白点击设置、避开要素与发帖放置态），无锚点时回退地图中心。卡片标题随之「锚点周边/人气活动」。
- **聚合/单点配色**：聚合主圆按 point_count 渐变柔和蓝 + 半透明 + 柔白边 + blur 光晕「呼吸」动效（rAF 改 halo 透明度，卸载 cancel）；单点加分类色柔光垫底。目的：与马卡龙底图协调、不突兀。
- **地标可点击**：点击 `landmark-icon` → 先弹**名胜介绍卡**（`.tem-lm*`，暖色渐变 + 类型徽章 + 一句话简介 `Landmark.blurb`，与白色活动卡区分），卡内「问 AI 导游」按钮才 `openGuide` 锁定该名胜。不直接跳 AI。
- **精选美食 POI**：`lib/foodSpots.ts` 人工精选东京评分>4.0 名店（餐厅是常驻 POI，不进带时间的活动模型）。独立 `food` 图层（玫红叉勺图标），点击弹 `.tem-food` 卡（评分 + 招牌菜单 + 问 AI）。**不实时抓取**：食べログ禁爬/ToS、Google Places 付费+存储受限、Hot Pepper 无评分；故走精选（评分/菜单为人工标注）。左下角「美食」开关 + localStorage。
- **车站 / 铁路线数据 = OpenStreetMap（Overpass API）**：`scripts/enrich-station-lines.ts` 拉东京 bbox 内 `route`(subway/train/light_rail/monorail) 关系，**离线生成两个静态文件**——`public/stations.json`(站点点位+经过线路) 与 `public/lines.json`(每条线**有序站点序列**，取最长方向变体)。过滤无品牌色的特急/观光列车、只保留有线路代码(JY/M/OH…)的真线路、清方向/服务后缀、按代码+名去重。前端一次性加载，不走服务端/DB。
  - **方向**：OSM 关系成员有序但每方向常是独立关系；为稳定起见只存一条规范顺序，UI(`LinePanel`)用正/反序呈现两个方向（标「往 X 方面」），点站点 `flyTo` 定位。
  - **时刻表不接 OSM**（OSM 无此数据），改接 **ODPT（公共交通开放数据中心 odpt.org）**：`ODPT_API_KEY`（人工注册的 Access Token，存 `.env` 不提交）。`services/odpt.ts` 按站名查 `odpt:Station`（坐标就近 ~1.3km 过滤同名站）→ 取 `odpt:StationTimetable` → 按今天日历(平日/周末节假日，**节日精确判定留待后续**)挑当前方向算「下一班」→ 按线路/方向分组。方向/种别/线路名用小型词表(RailDirection/TrainType/Railway)的 `dc:title`，**进程内缓存** 24h；时刻表按站缓存 6h。**入口**：点车站卡片某线路 chip → `LinePanel`（单条线，换线退出重选）。顶部=该线本站各方向近几班发车合并按时间排序（默认最近一班）；主体=选中那班车的逐站时刻（`/api/train-timetable`，标当前站），换顶部时刻则主体更新；无 ODPT 时刻表的线退回全程站点图（lines.json）。OSM 线名↔ODPT 线路标题按互相包含匹配。原独立「时刻表」按钮与 `TimetablePanel` 已移除。
  - **实时列车位置**：`odpt:Train`（`/api/train-positions`，缓存 20s）。**仅都営等提供，Metro/JR 无**。在区间(from+to)的列车标在两站之间，仅停靠(只有 from)的标在该站。**ODPT 时刻表覆盖很窄**：实测仅 東京メトロ/都営/臨海線(TWR)/ゆりかもめ/多摩都市モノレール 有 StationTimetable+TrainTimetable；**JR东日本/JR东海 及 小田急/京王/东急/京急/西武/东武/京成 等大私铁均为 0**（Station/Railway 静态目录有，但时刻表数据集未公开，且 ODPT 后台无申请入口——不是权限问题）。未覆盖的站时刻表面板显示空+说明。
  - **逐站时刻**：StationTimetable 的发车带 `odpt:train` → 拉 `odpt:TrainTimetable` 得该班车逐站到/发时刻（真实排点）；站名按线路缓存 `odpt:Station` 解析（含直通别线）。`/api/train-timetable` + `TrainTimetablePanel`。
  - **运行情况**：`odpt:TrainInformation`（缓存 90s）→ 每线路状态文本；「正常」措辞各社不同做归一（平常どおり/遅延はありません…）。
  - 实时延误分钟数/列车位置（`odpt:Train`）留待后续。
- **换乘导航 = 连通图路由（非时刻表路由）**：`services/routePlanner.ts` 用 `lines.json`+`stations.json` 建图（节点=(线,站)；乘车边**按相邻站实距**算耗时，同名站换乘边，<320m 步行换乘边）跑 Dijkstra，出推荐/少换乘两套。**不做时刻表级 RAPTOR**——JR/大私铁时刻表 ODPT 没有，做不了；连通图覆盖全网（拓扑来自 OSM）、耗时为估算。图进程内缓存。`/api/route` + `RoutePanel`（车站卡片「从这导航」），选中方案在地图画线路色折线，首段叠 ODPT 下一班。**为何不用 LLM**：拓扑数据本地已有，确定性图路由更准更省。
- **锚点针（拖拽放置）保留 DOM SVG marker**，现代扁平蓝色水滴造型
- **同位置/极近活动 → 堆叠卡片弹窗**：
  - 点击单点时 `queryRenderedFeatures` 取点击像素 ±14px 内的所有点；点击聚合时取 `getClusterLeaves`，若叶子坐标包围盒 < 0.0006°（约 60m）判定为"挤在一起"，直接弹堆叠卡片，否则 `easeTo` 放大展开
  - 弹窗卡片信息更详细（分类色条 + 时间 + 标题 + 场馆 + 地址 + 来源/删除），整卡可点
  - 卡片点击 → `router.push('/recommend?event=<id>')`，推荐页 `RecommendList` 读 `?event=` 自动打开对应详情抽屉。**列表是子集**（过滤过期 + 固定 bbox + ISR 缓存），命中不了时**按 id 直接 `GET /api/events/[id]` 拉取再打开**，不耦合列表是否含该活动——否则地图点过期/超范围活动只能停在推荐页。
  - 弹窗卡片样式集中在 `globals.css` 的 `.tem-*` 类；`.maplibregl-popup-content` 已 `padding:0`，所以打卡弹窗内联补了自己的 padding

## 主题

- **v1 固定亮色**：`globals.css` 设 `color-scheme: light` 并移除 `@media (prefers-color-scheme: dark)`。底图与所有卡片都按亮色设计，强制 light 避免 OS 夜间模式把页面翻黑导致文字看不清。深色模式留到 v1.5（需为卡片/弹窗补 `dark:` 变体）。

## 数据模型

- **官方活动(`Event`)与用户发帖(`Post`)分表**：`Event` = 抓取的官方活动（只读、带 `sourceType`/`sourceUrl`/`trustLevel`/`rawText` 来源元数据）；`Post` = 用户发帖（可编辑/删除、带 `userId` 作者、可多图 `imageUrls`、可 `signupEnabled`）。两表 **id 全局唯一**（迁移时 Post 复用了原 Event.id），故可凭一个 id 反查归属表。
  - **互动多态**：`Comment`/`Reaction`/`CheckIn` 用 `eventId` 与 `postId` 二选一（各自 `onDelete: Cascade`）；`Reaction` 双唯一 `@@unique([userId,eventId,type])` + `@@unique([userId,postId,type])`（Postgres 多 NULL 不冲突）。service 层 `resolveTarget(id)` 先查 Event 再查 Post 决定写哪列；前端只传一个 id、不感知分表。
  - **读路径合并**：`getEventsInBounds`/`getEventById`/收藏/报名 把两表并起来统一成 `NormalizedEvent`（`normalizeOfficial`/`normalizePost`，Post 映射 `sourceType="USER"`/`trustLevel=10`/`address=null`/`summary=null`）。**DTO 形状不变**，前端按 `sourceType==="USER"` 判断发帖（mineOnly 过滤、删除按钮）照旧。
  - **AI 导游**（`guideEvents`）只读官方 `Event`（不把用户发帖当权威活动推荐）。
  - 迁移脚本：`scripts/split-posts.ts`（一次性，已执行）。
- `Event.sourceType` + `Event.trustLevel`：来源无关设计，为多源/社交接入预留
- 时间统一 UTC 存储，展示转东京时区
- v1 只用普通 lat/lng + 矩形范围查询，不启用 PostGIS/pgvector

## 数据源与抓取

- **统一 Source 接口**：`fetch() → RawDocument[]`，文档要么 `prestructured`（已结构化，跳过 LLM），要么 `text`（走 LLM 抽取）。新增源只需实现接口并在 `sources/index.ts` 注册。
- **主力源 = 内嵌 JSON-LD 的活动媒体**（SSR、稳定、零 LLM 成本）：
  - **walkerplus**（ar0313 东京全域）：翻 `WALKERPLUS_MAX_PAGES` 页（默认 8）收集站内详情页 URL（`/event/ar0313eXXX/`）→ **逐个抓详情页**拿 `streetAddress`（番地级；列表页只到区级、GSI 退回区中心）。UTF-8 编码。全域列表已涵盖各区，不逐区抓。
  - **jalan**（じゃらん，地域码 130000）：列表页约 30 个，但**列表地址只到区/町**（GSI 会退回都厅、点糊在一处）→ **逐个抓详情页**取 `streetAddress`（番地级精确）。**坑：Shift_JIS(Windows-31J) 编码**，必须 `arrayBuffer()`+`TextDecoder("shift_jis")` 解码 + 浏览器 headers，否则解析 0；详情页间加礼貌延迟。
  - 解析/分类/映射共享在 `sources/jsonLd.ts`；有 `streetAddress` 时**直接用**（不与 region/locality/venue 重复拼接，否则干扰 GSI）。
- **GO TOKYO 等 SPA 不接入**：靠封闭私有搜索 API 动态加载，参数不可逆向、易随改版失效。选源优先"内嵌标准 JSON-LD 且 SSR"。
- **sourceUrl = 每条活动自己的详情页/官网**（JSON-LD 的 `url`），缺失才回退源列表页。ingest 去重键 **`(title, sourceUrl)`**——**不含 startTime**：日期源无时区，不同环境解析出的 UTC 会漂移，曾导致重复入库；JSON-LD 日期统一补 `+09:00`（东京）使存储也稳定。跨源去重（同活动两站都收录）留到后续。
- **地理编码（GSI）**：地址规范化（"東京"→"東京都"，否则 GSI 把"東京X"误判到北海道札幌）+ **东京边界校验**（解析到框外一律判失败，宁缺毋滥）。含建筑名/设施名的地址 GSI 易落到区中心 → 可选 `GEOCODE_LLM_FALLBACK`：用 LLM 把地址规范成标准住所再编码（如「東京タワー」→「東京都港区芝公園」），东京边界校验兜底幻觉。
- **分类**：JSON-LD 不带分类 → 先关键词（`classifyByKeyword`，"快闪/IP 体验展"等易误判 OTHER）；可选 `CLASSIFY_WITH_LLM=true` 用 LLM（DeepSeek/Claude）批量重判，关闭或缺 key 时零成本回退关键词。
- **一句话摘要（`Event.summary`）**：活动 description 冗长/缺失，地图标签直接截取效果差 → 抓取管线用 LLM 为每条生成 ≤14 字短摘要（`summarizeEvents`，批量 30，硬截 14 字），存 `Event.summary`。开关 `SUMMARIZE_WITH_LLM=true` + 有 key 才启用，失败静默回退 null。地图标签优先级 `summary → description → 分类名 → 标题`。
- **改了来源/坐标逻辑后用 `npm run extract -- --reset`**：先清掉抓取来的活动（保留发帖/打卡）再重抓，避免旧坏数据残留 + sourceUrl 变化导致重复。
- **体育子分类源** `walkerplus-sports`（`ar0313/eg0108`）：复用 walkerplus 工厂逻辑，分类**强制 `SPORTS`**（整页都是体育，跳过关键词判定）。

## 数据更新机制（每日定时，GitHub Actions）

- **数据全用户共享、无需手动刷新**：已移除地图页手动「刷新」按钮，改为**每日凌晨自动抓取**。
- **不用 Vercel Cron**：完整抓取要数分钟，超过 Vercel 函数超时（Hobby 60s / Pro 300s），Cron 触发会中途超时、留半截数据。
- **用 GitHub Actions**：`.github/workflows/extract.yml`，`0 18 * * *`(UTC)=**03:00 JST**，直接 `npm run extract` 连 Neon 写库（无超时），也可手动 `workflow_dispatch`。网站(Vercel)与抓取解耦，只读库。
- **所需 GitHub Secrets**：`DATABASE_URL`（必填，Neon 连接串）；`LLM_API_KEY`（可选，DeepSeek key → 启用 LLM 重分类，失败回退关键词）。workflow 内固定 `LLM_PROVIDER=deepseek`、`CLASSIFY_WITH_LLM=true`、`SUMMARIZE_WITH_LLM=true`（LLM 生成活动一句话摘要）。
- **`/api/extract`**：保留 GET/POST，受 `CRON_SECRET` 保护（设了才校验），供需要时手动 curl 触发；不再由 Vercel Cron 调用。

## 导航与页面

- 底部 4 tab：地图 / 日历 / 推荐 / 个人（`grid-cols-4`）
- **页面切换动画**：`app/template.tsx`（每次导航重新挂载）给每个 tab 入场动画（淡入 + 上滑 `tem-page-in`）；server 页（推荐/日历/个人）各配 `loading.tsx` 即时显示加载态、`BottomNav` 乐观高亮（点击立即高亮目标），消除切换"卡住"感
- **日历页**按"东京时区当天"对活动分组；**长期活动（startTime→endTime 跨天）在展期每一天都出现**（按 UTC 午夜逐天填充，guard 防超长），清单里标「展期中」。详情统一复用 `Recommend/EventDetail`（地图弹窗、推荐、日历三处入口共用同一详情抽屉）
- **推荐页**支持分类 chip + 时间筛选（客户端过滤瀑布流）
- **时间筛选 = 可视化日历范围**（地图 + 推荐共用 `CalendarRangePicker`）：值为 `DayRange`（YYYY-MM-DD，全 null=全部），按**东京日历日**判活动区间重叠（`lib/dateFilter.ts`）。地图筛选面板内嵌日历、推荐页用下拉日历。选了含过去的范围时自动忽略「过期」过滤。发帖/打卡时间用同源 `DateTimeField`（日历单选+时分），输出 `datetime-local` 同款字符串、不改表单逻辑。
- **详情（EventDetail）**：`fixed inset-0` 全屏铺满（同发帖 form）、盖住底部 tab；**头部固定**（分类/标题/日期下滑时常驻），地点/图片/简介/评论在滚动区；右上角 × 关闭；图片 `object-contain`（看全原图）。显示**发帖人**（`EventDTO.author`）与**评论作者**（头像无图时首字母兜底，旧 `me` 评论显示「用户」）。发帖人/评论作者数据：评论 join User、活动 `getEventsInBounds`/`listUserEvents` 批量附 author（仅 USER 帖），page 序列化时带 `author`
- **发帖/打卡 sheet**（`BottomSheet`）：`fixed inset-x-0 bottom-0 z-[999]`，full 全屏 `h-[100dvh]`（顶贴顶、底贴底、隐藏滚动条；**注意 `max-h-%` 在无固定高度父级下失效，高度用 `vh/dvh`**）。peek/full 两档拖动切换（peek 上拉不越顶），**不因下拉直接取消**，关闭走右上角 ×。打卡与发帖共用，均支持 Cloudinary 图片上传 + 自定义时间。表单控件统一用 `formStyles.ts`（浅灰底圆角 + 蓝色聚焦环、圆角分类标签、虚线图片上传区），简约现代、与全站一致

## 天气

- 入口在地图页（`WeatherPanel`）：按钮显示当前温度，点开 → 底部横向滑 7 天卡片 + 地图上层天气动画
- 动画（`WeatherAnimation`）按当前天气大类切换，CSS keyframes 实现，`pointer-events:none`，纯装饰
- 动画**区分昼夜**：东京 18:00–翌 6:00 判为夜（`Intl` 取东京小时）。晴天夜晚 = 月亮 + 闪烁星空（替代太阳），雨/雪/云夜晚叠一层夜色遮罩，与白天明显区分
- 图层级约定：地图 canvas < 天气动画(z-10) < 天气卡片条(z-20) < FAB/弹窗/Toast(z-30)

## 复制能力

- `lib/clipboard.ts` 统一封装：优先 Clipboard API，失败回退 `execCommand`。注意：自动化/无头浏览器会禁用剪贴板（NotAllowedError + execCommand=false），真机用户手势下正常

## 图片存储

- **图片二进制绝不进数据库**，DB（`Event.imageUrl`）只存一条 URL 字符串。Neon 免费额度不被图片占用。
- **发帖图片走 Cloudinary**（unsigned upload preset，客户端直传、不经服务器），自带压缩/CDN，跨设备与部署都能访问。返回 `secure_url` 时插入 `q_auto,f_auto` 做交付优化。
- 上传前**客户端先压缩**（`lib/image.ts`：canvas 缩到最长边 1280 + JPEG q0.8）。
- 配置用两个**可公开**变量：`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`（非密钥，可进 `.env.example`）。未配置时发帖图片入口显示提示、不阻塞发帖。
- 已建预设：**`cloudfootprints_unsigned`**（unsigned，folder `cloudfootprints`，仅图片格式）。App **只用 cloud name + 该 preset**；**Cloudinary API Key/Secret 一律不用于 App、不写入任何文件或仓库**（仅在控制台/Admin API 一次性建预设时用过）。两台 PC 各自把这两个公开值填进自己的 `.env`。Secret 若在对话/外部暴露过应去控制台轮换（不影响 App）。
- LLM 抽取的活动图片（`imageUrl`）是源站的外链，不转存（v1）。

## AI 导游

- 资深导游 system prompt：讲解活动信息 / 历史文化渊源 / 看点 / 推荐 / 路线交通建议；**纯文本输出**（约束不用 Markdown）；不编造具体票价时间。复用 LLM 层（`chatWithGuide`，DeepSeek/Claude），`/api/chat` 保留最近 12 轮。
- **全局化**：`GuideContext`（layout 挂载 `GuideProvider` + `GuideChat` 面板），任何组件 `useGuide().openGuide(topic?)` 即可打开。地图页 `GuideFab` 通用入口；活动详情 / 地图弹窗带 `topic`（活动信息）打开 → 聚焦该活动：快捷问题嵌入活动名 + 首条消息注入活动上下文。

## 阶段约束

- **只实现 v1**，v2/v3 功能（审核、个性化推荐、Python 服务）不超前实现，代码用 `TODO` 标注挂载点
- 下一阶段（v1.5）：锚点发帖完善（地图风格切换器已实现：标准/柔和）
- **用户系统**：✅ 已实现（本地账号 + 认证 + 个人资料 + 未登录拦截，见上「架构」与 CHANGELOG）。
- **收藏 / 点赞（#2）**：✅ 已实现。`Reaction` 单表 + `ReactionType`(LIKE/FAVORITE) 区分，唯一约束 `(userId,eventId,type)`；`services/reactions.ts` + `/api/events/[id]/reactions`（GET 状态 / POST 切换需登录）+ `/api/favorites`。详情页头部点赞/收藏按钮（乐观更新+回滚），个人页「收藏」tab。**改 schema 后 dev server 必须重启**才会加载新 Prisma client。
- **评论作者展示（待实现）**：Comment 记录真实 userId 后，列表 join User 显示用户名/头像。

## 社区模拟（V7 Agent Architecture）

> 总设计见 `docs/Agent_Architecture.md`（愿景：记忆驱动的社区模拟，内容是「活着」的副产物，不是 `prompt→帖子`）；人物画像见 `docs/demo-personas.md` + 机器可读版 `src/lib/personas.ts`。

- **目标**：把 12 个 demo 账号从「静态测试数据」变成「有记忆、有情绪/目标、有弱关系、会演化」的社区。核心链路 `记忆 → 关系 → 事件 → 行为 → 内容`。
- **时间线 epoch = `2026-02-01`**（`personas.ts` 的 `SIM_EPOCH`）：已有内容算「最近几个月」；Feb→现在的内容在 Phase 2 生成补全，推演从「现在」往后单调推进。
- **内部状态表与对外内容表分离**（Phase 1 已建，`prisma db push` 入库，非破坏性）：
  - `Memory`（记忆：`type` EVENT/RELATIONSHIP/MILESTONE/GOAL/SUMMARY、`importance` 1–3、`happenedAt` 可回填过去、`decayAt` 衰减、`sourceCheckInId` 溯源去重）
  - `CharacterState`（每人一行：`emotion` jsonb 0–100 / `goals` / `lifeStage` / `lastActiveAt`）
  - `Relationship`（弱连接：`strength` 0–100 / `sentiment` -100–100，规范化 `aId<bId` 唯一，成长慢、自然衰减）
  - `WorldState`（每天一行：季节/天气/城市情绪/热点）
  - 对外内容仍只用 `CheckIn/Post/Comment`，模拟状态不直接展示。
- **配图视角**（`personas.ts` 的 `photoSkill`）：`casual` 日常一律**主观镜头**（手机随手拍）；`hobby`（遥/葵）平时主观、出「作品」才客观；`pro`（たけし）可讲究构图。规则写入 `docs/demo-personas.md` 配图规则。
- **Phase 1（已完成，纯工程无 AI）**：建 4 表 + `src/lib/personas.ts` 结构化档案 + `scripts/sim-init.ts` 回填（现有足迹→初始 Memory、按 persona 初始化 CharacterState、按 friends 建 Relationship）。可重复执行、幂等（记忆按 `sourceCheckInId` 重建）。
- **Phase 2（待办）**：每日 cron（凌晨 3 点，复用 `CRON_SECRET` 鉴权）跑 World Agent → 各角色决策(haiku，几十 token) → 写 Memory → 概率发内容；白天用户纯读 DB、不调 Claude。先只产 CheckIn 再加 Post/Comment。补全 Feb→现在的内容。
- **Phase 3/4（待办）**：每周 Community/Career、每月人生事件 + 记忆压缩（30 天→生活摘要）；关系/八卦/恋爱极低概率。`ImageProvider` 统一接口（当前 Unsplash+Cloudinary，未来可换 Agnes，**接口先行不绑死**）。
- **成本取向**：12 人每天一跑、haiku 决策为主，日成本可忽略；用 GitHub Actions 或 Vercel Cron 均可（重活已有 Actions 先例）。
