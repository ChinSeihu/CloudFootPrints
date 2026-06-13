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
- **锚点针（拖拽放置）保留 DOM SVG marker**，现代扁平蓝色水滴造型
- **同位置/极近活动 → 堆叠卡片弹窗**：
  - 点击单点时 `queryRenderedFeatures` 取点击像素 ±14px 内的所有点；点击聚合时取 `getClusterLeaves`，若叶子坐标包围盒 < 0.0006°（约 60m）判定为"挤在一起"，直接弹堆叠卡片，否则 `easeTo` 放大展开
  - 弹窗卡片信息更详细（分类色条 + 时间 + 标题 + 场馆 + 地址 + 来源/删除），整卡可点
  - 卡片点击 → `router.push('/recommend?event=<id>')`，推荐页 `RecommendList` 读 `?event=` 自动打开对应详情抽屉
  - 弹窗卡片样式集中在 `globals.css` 的 `.tem-*` 类；`.maplibregl-popup-content` 已 `padding:0`，所以打卡弹窗内联补了自己的 padding

## 主题

- **v1 固定亮色**：`globals.css` 设 `color-scheme: light` 并移除 `@media (prefers-color-scheme: dark)`。底图与所有卡片都按亮色设计，强制 light 避免 OS 夜间模式把页面翻黑导致文字看不清。深色模式留到 v1.5（需为卡片/弹窗补 `dark:` 变体）。

## 数据模型

- `Event.sourceType` + `Event.trustLevel`：来源无关设计，为多源/社交接入预留，v1 不做去重
- 时间统一 UTC 存储，展示转东京时区
- v1 只用普通 lat/lng + 矩形范围查询，不启用 PostGIS/pgvector

## 数据源与抓取

- **统一 Source 接口**：`fetch() → RawDocument[]`，文档要么 `prestructured`（已结构化，跳过 LLM），要么 `text`（走 LLM 抽取）。新增源只需实现接口并在 `sources/index.ts` 注册。
- **主力源 = 内嵌 JSON-LD 的活动媒体**（SSR、稳定、零 LLM 成本）：
  - **walkerplus**（ar0313 东京全域）：翻 `WALKERPLUS_MAX_PAGES` 页（默认 8）收集站内详情页 URL（`/event/ar0313eXXX/`）→ **逐个抓详情页**拿 `streetAddress`（番地级；列表页只到区级、GSI 退回区中心）。UTF-8 编码。全域列表已涵盖各区，不逐区抓。
  - **jalan**（じゃらん，地域码 130000）：列表页约 30 个，但**列表地址只到区/町**（GSI 会退回都厅、点糊在一处）→ **逐个抓详情页**取 `streetAddress`（番地级精确）。**坑：Shift_JIS(Windows-31J) 编码**，必须 `arrayBuffer()`+`TextDecoder("shift_jis")` 解码 + 浏览器 headers，否则解析 0；详情页间加礼貌延迟。
  - 解析/分类/映射共享在 `sources/jsonLd.ts`；有 `streetAddress` 时**直接用**（不与 region/locality/venue 重复拼接，否则干扰 GSI）。
- **GO TOKYO 等 SPA 不接入**：靠封闭私有搜索 API 动态加载，参数不可逆向、易随改版失效。选源优先"内嵌标准 JSON-LD 且 SSR"。
- **sourceUrl = 每条活动自己的详情页/官网**（JSON-LD 的 `url`），缺失才回退源列表页。ingest 去重键 `(title, startTime, sourceUrl)` 随之更稳（同活动 url 稳定，跨页/重抓判重成立）。跨源去重（同活动两站都收录）留到后续。
- **地理编码（GSI）**：地址规范化（"東京"→"東京都"，否则 GSI 把"東京X"误判到北海道札幌）+ **东京边界校验**（解析到框外一律判失败，宁缺毋滥）。含建筑名/设施名的地址 GSI 易落到区中心 → 可选 `GEOCODE_LLM_FALLBACK`：用 LLM 把地址规范成标准住所再编码（如「東京タワー」→「東京都港区芝公園」），东京边界校验兜底幻觉。
- **分类**：JSON-LD 不带分类 → 先关键词（`classifyByKeyword`，"快闪/IP 体验展"等易误判 OTHER）；可选 `CLASSIFY_WITH_LLM=true` 用 LLM（DeepSeek/Claude）批量重判，关闭或缺 key 时零成本回退关键词。
- **改了来源/坐标逻辑后用 `npm run extract -- --reset`**：先清掉抓取来的活动（保留发帖/打卡）再重抓，避免旧坏数据残留 + sourceUrl 变化导致重复。

## 导航与页面

- 底部 4 tab：地图 / 日历 / 推荐 / 个人（`grid-cols-4`）
- **页面切换动画**：`app/template.tsx`（每次导航重新挂载）给每个 tab 入场动画（淡入 + 上滑 `tem-page-in`）；server 页（推荐/日历/个人）各配 `loading.tsx` 即时显示加载态、`BottomNav` 乐观高亮（点击立即高亮目标），消除切换"卡住"感
- **日历页**按"东京时区当天"对活动分组；**长期活动（startTime→endTime 跨天）在展期每一天都出现**（按 UTC 午夜逐天填充，guard 防超长），清单里标「展期中」。详情统一复用 `Recommend/EventDetail`（地图弹窗、推荐、日历三处入口共用同一详情抽屉）
- **推荐页**支持分类 chip 筛选（客户端按 `category` 过滤瀑布流）
- **详情抽屉**：`fixed inset-0 z-50` 铺满屏、盖住底部 tab 导航；图片用 `object-contain`（看全原图，不裁剪）
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
- 下一阶段（v1.5）：锚点发帖完善、地图风格切换器
- **用户系统**：✅ 已实现（本地账号 + 认证 + 个人资料 + 未登录拦截，见上「架构」与 CHANGELOG）。
- **收藏 / 点赞（#2，待实现）**：依赖用户系统；新增收藏（用户↔活动）与点赞表 + API + UI。
- **评论作者展示（待实现）**：Comment 记录真实 userId 后，列表 join User 显示用户名/头像。
