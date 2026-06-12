# 修改履历

> 记录每次功能变更的内容、涉及文件、背景说明。时间倒序排列（最新在上）。

---

## 2026-06-13

### UI 优化：天气昼夜 + 页面切换动画 + 详情全屏/原图 + sheet 拖动

5 项体验改进：

1. **天气特效区分昼夜**：`WeatherPanel` 按东京当前时间（18:00–翌 6:00 为夜）算 `isNight` 传给 `WeatherAnimation`；晴天夜晚显示月亮 + 闪烁星空（替代太阳），雨/雪/云夜晚叠一层夜色遮罩，与白天明显区分。
2. **tab 切换动画**：新增 `app/template.tsx`（App Router template 每次导航重新挂载）→ 触发淡入 + 上滑（`tem-page-in` 0.28s），让切换被感知。
3. **推荐详情弹窗铺满屏**：`absolute inset-0 z-30` → `fixed inset-0 z-50`，盖住底部 tab 导航，不再漏出。
4. **详情图片完整显示**：上传/活动图从 `object-cover` 改 `object-contain`（+ 浅灰底 + `max-h-[60vh]`），原图不裁剪、看全。
5. **发帖/打卡 sheet 拖动不再取消 + 定位修复**：下拉只在 peek/full 两档间切换（full→peek 保留已填表单），**不再因下拉直接取消**；新增右上角 × 明确关闭；保留"上拉填写 ›"两步流程。另修：`max-h-[82%]` 因父容器（`absolute` 无明确高度）失效，表单被撑过屏幕顶、抓手被挤出 → 改 `fixed inset-x-0 bottom-0 z-50` + `max-h-[88vh]`，表单底部贴屏幕底（盖底部导航）、顶部留出抓手拖动区。

**涉及文件：** `components/Map/{WeatherPanel,WeatherAnimation,BottomSheet}.tsx`、`components/Recommend/EventDetail.tsx`、`app/template.tsx`、`app/globals.css`

---

## 2026-06-12

### 修复：walkerplus 也抓详情页（定位精确到番地）

**背景：** walkerplus 抓的活动定位不准——列表页 JSON-LD 地址只到区级（如"東京都江東区"），GSI 退回区中心，同区活动糊成一团。

**修复：** 与 jalan 同思路——翻页先收集站内详情页 URL（`/event/ar0313eXXXXXX/`），再逐个抓详情页拿 `streetAddress`（番地级，如"東京都江東区有明3-3-8"）。walkerplus 是 UTF-8，无需特殊解码。

**实测：** 渋谷リアル・イカゲーム→道玄坂、ホグワーツ→练马春日町、ピクサー展→豊洲，均番地级精确。代价：详情请求增多、extract 变慢（低频手动可接受）。

**涉及文件：** `src/services/extraction/sources/walkerplus.ts`

---

### 修复：来源外链跳详情页 + 地址定位（jalan 抓详情页、东京边界校验）

**背景：** 两个 bug——①"来源"链接全跳到列表页；②地图标点明显偏移（jalan 活动被标到北海道札幌）。

**根因 & 修复：**
1. **外链跳列表**：活动 `sourceUrl` 统一存了源列表页 URL。其实 JSON-LD 每条活动有自己的 `url`（jalan=详情页、walkerplus=官网）。
   - `ExtractedEvent` 加 `sourceUrl` 字段；`ldToExtracted` 填 `e.url`、connpass 填 `e.url`；ingest 用 `ev.sourceUrl ?? source.sourceUrl`（存库 + 去重键同步）。
2. **地址偏移**：
   - jalan 的 `addressRegion="東京"`（非"東京都"）→ GSI 把"東京X"整体误判成**北海道札幌市東区**。**geocode 加地址规范化（東京→東京都）+ 东京边界校验**（解析到东京框外一律判失败，宁缺毋滥）。
   - jalan 列表页地址只到区/町 → GSI 退回都厅、一堆点糊在一处。**改为逐个抓详情页**，详情页 JSON-LD 带 `streetAddress`（街道+番地），地址精确到番地级。
   - `ldToExtracted`：有 `streetAddress` 时直接用，不再与 region/locality/venue 重复拼接干扰 GSI。

**数据刷新（重要）：** 旧坏数据（札幌点、列表页 sourceUrl）需清理重抓——新增 `npm run extract -- --reset`：先清掉抓取来的活动（保留发帖/打卡），再重抓。

**实测：** 山王祭→日枝神社、新橋こいち祭→港区新橋、羽田まつり→羽田，均番地级精确、无札幌点；`tsc` 全绿。

**涉及文件：** `extraction/{types,ingest,geocode}.ts`、`sources/{jsonLd,jalan,connpass}.ts`、`scripts/run-extraction.ts`

---

### 抓取增强：分页 + LLM 分类 + 第二来源 jalan

**背景：** 三点优化——抓更多、分类更准、多来源。

**实现：**
1. **walkerplus 分页**：东京全域列表按 `/ar0313/{N}.html` 抓前 `WALKERPLUS_MAX_PAGES` 页（默认 8≈80 个），页间 700ms 延迟、跨页去重；**所有页统一用列表首页作 sourceUrl**，保证 ingest 的 `(title,startTime,sourceUrl)` 去重在跨页/重抓时仍正确。全域列表已涵盖各区，故不逐区抓（逐区只会大量重复）。
2. **LLM 重分类（可选）**：`lib/llm.ts` 加批量 `classifyEvents`（复用 anthropic/deepseek provider 切换）；管线对 prestructured 源调用 `maybeReclassify`。开关 `CLASSIFY_WITH_LLM=true` 且有 LLM key 才启用，否则零成本回退关键词（关键词把"快闪/IP 体验展"等误判为 OTHER 偏多）。
3. **第二来源 jalan**：じゃらん东京活动列表（地域码 130000），SSR + 标准 JSON-LD，单页 30 个、含街道级地址。**坑：jalan 是 Shift_JIS(Windows-31J) 编码**，必须 `arrayBuffer()` + `TextDecoder("shift_jis")` 解码，否则日文乱码致 `JSON.parse` 失败、解析到 0。还需补全浏览器 headers（UA/Accept/Accept-Language）。
4. **共享解析**：抽 `sources/jsonLd.ts`（`extractLdEvents` / `classifyByKeyword` / `ldToExtracted`），walkerplus 与 jalan 复用。
- **GO TOKYO 未接入**：它是 SPA + 封闭私有搜索 API（参数不可逆向、易随改版失效），不符合"稳定源"原则；改用 jalan 这个稳定 JSON-LD 源达成"多来源"。

**实测：** walkerplus 3 页=30、jalan 1 页=30，均全带图带址；`tsc --noEmit` 全绿。

**涉及文件：** `src/services/extraction/sources/{walkerplus,jalan,jsonLd,index}.ts`、`extraction/{classify,index}.ts`、`src/lib/llm.ts`、`.env.example`

---

### 真实数据源：Walkerplus（解析页面 JSON-LD）

- **放弃 connpass 做主力**：它是 IT 勉強会平台，与"展览/市集/live/祭典"定位不符（顶多做 TALK 补充）。
- 新增 **walkerplus 源**：抓东京活动列表页，解析页面内嵌的 schema.org **JSON-LD**（`@type: Event`），**直接拿到结构化活动**（名称/起止日期/图片/场馆/地址/简介），无需 LLM 啃自由文本；分类用关键词推断（不准则归 OTHER）。
- robots.txt 允许 `/event_list/`；地理编码用「都道府县+区+场馆名」，GSI 命中率高。手动低频抓取、尊重站点条款。
- **实测**：一页 10 个真实活动**全部入库**，地理编码 **0 失败**，**全部带图片**，展览分类准确。
- TODO：分页/多区域拿更多；可选用 LLM 增强分类。

**涉及文件：** `src/services/extraction/sources/walkerplus.ts`（新）、`.../sources/index.ts`

### 恢复活动聚合（单点才加图标）+ 筛选改左侧可收起

- **修正**：上一版误删了活动聚合。现在恢复——缩小时合并成**蓝色大圆 + 数量**（聚合圆**不加**分类 icon）；放大到单点时 = **分类色圆 + 分类图标**（图标加大：`icon-size` 0.6→0.85，圆 radius 12→14）。聚合圆点击放大展开 / 同位置堆叠卡片逻辑一并恢复。
- 去掉 USER 发帖点的**黑色描边**，统一白边。
- **#2 筛选改版**：左上角一个「筛选」按钮（带激活数徽标）+ 展开面板（分类 / 时间段 / 含过期 / 只看我的）；收起时只剩 筛选 + 刷新 + 计数，不再用隐蔽的横向滚动，也不挡右上角地图控件/天气。

**涉及文件：** `src/components/Map/MapExplorer.tsx`、`src/components/Map/Filters.tsx`

### 发帖/打卡选日期 + 表单可吸附（peek）+ 天气实况提示

- **#6 表单改为可吸附 sheet**：默认 **peek**（只露标题，地图可见 → 拖锚点定位），**上拉填写**；从 full **下拉回 peek**（重新定位），peek 再下拉才关闭。移除上一版"定位条 + `formOpen`"两步逻辑，统一到 `BottomSheet`。
- **#3 选日期**：发帖加"时间范围"（开始/结束 `datetime-local` → ISO）；打卡加"时间"（可补录过去打卡，覆盖 `createdAt`）。后端 `createUserEvent`/`createCheckin` + 两个 POST 路由透传。
- **#5 天气歧义提示**：天气面板加实况条「现在 X° · 动画为实况，下为未来 7 天」，区分"地图动画=当前实况"与"卡片=未来预报"。

**涉及文件：** `BottomSheet.tsx`、`PostDialog.tsx`、`CheckInDialog.tsx`、`MapExplorer.tsx`、`WeatherPanel.tsx`、`services/{events,checkins}.ts`、`api/{events,checkins}/route.ts`

### 活动点加分类图标（去聚合）+ 天气置顶

- **活动点不再聚合**（用户反馈聚合大圆不直观）：每个活动 = 分类色圆 + **白色分类图标**（symbol 图层，`icon-image` 按 `category` 动态取图，图标位图由 `CATEGORY_GLYPH` 渲染成 data URL 注册），辨识度更高；USER 发帖用**深色描边**区分抓取活动。
- 移除事件聚合图层（halo / clusters / count）与点击展开逻辑；**打卡仍保留聚合**（带数量气泡）。
- **天气按钮 `z-[999]`**（不再被 FAB/打卡遮挡）；天气卡片条提到 `z-[60]`。

### 移动端 UI 修复 + 锚点两步交互 + 打卡对勾图标

1. **移动端筛选栏不再叠在地图控件/天气上**：容器改 `right-14 sm:right-3` 清开右侧缩放/定位控件；分类行与第二行由换行改为**横向滚动**（不再堆叠）。375px 实测：筛选栏右沿 319px、地图控件左沿 336px，不重叠。
2. **打卡/发帖改为两步交互**：点 ➕ 选动作 → 先落**可拖动锚点 + 底部「定位条」**（取消 / 下一步），定位好再点「下一步」才弹输入表单 → **表单不再遮挡锚点**。新增 `formOpen` 状态。
3. **打卡点叠加白色对勾（√）图标**（canvas 画图标 → `map.addImage` → symbol 图层），与活动点（无对勾）一眼区分。
4. **Cloudinary 说明**：`NEXT_PUBLIC_*` 是编译期注入，改 `.env` 后必须**完整重启 dev**（非 HMR）才生效——这正是之前显示「未配置图床」的原因。已验证 `.env` 的 cloud name/preset 会被打进客户端 bundle。

**涉及文件：** `src/components/Map/Filters.tsx`、`src/components/Map/MapExplorer.tsx`

---

### Cloudinary 图床配置完成

- 用 Admin API 建好 unsigned 预设 **`cloudfootprints_unsigned`**（folder `cloudfootprints`，仅图片格式）。
- `.env` 填入 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`（公开值，不入库）。
- 用 unsigned 直传（**不带 Secret**）跑通真实上传验证：返回 `secure_url` + 尺寸/格式/体积元数据，`q_auto,f_auto` 优化正常。
- **安全**：App 不使用 Cloudinary API Key/Secret；二者不进代码/仓库。Secret 若曾暴露应在控制台轮换。
- 两台 PC 的 `.env` 各自填这两个公开值（`.env` 不随 git 同步）。

---

### 修复：构建自带 `prisma generate`（CI/部署/换机 implicit-any 报错）

**问题：** 在未先跑 `prisma generate` 的环境（Vercel/CI/另一台 PC）`yarn build` 时，`@prisma/client` 无类型 → `getEventsInBounds` 返回 `any` → `recommend`/`calendar` 页 `rows.map((e) => …)` 报「Parameter 'e' implicitly has an 'any' type」。本机能过只因本地早已生成过 client。

**修复：**
- `package.json`：`build` 改为 `prisma generate && next build`；新增 `postinstall: prisma generate`，使构建/安装自带生成、与环境无关。
- `prisma.config.ts`：datasource url 由 `env("DATABASE_URL")` 改为 `process.env.DATABASE_URL ?? ""`，让 `prisma generate`（不连库）在缺 `DATABASE_URL` 的构建环境也不抛错（迁移仍会因连不上而清晰报错）。

**部署提醒：** Vercel 等需在项目环境变量里设好 `DATABASE_URL` / `LLM_*` / `NEXT_PUBLIC_CLOUDINARY_*`（`.env` 不会被部署）。

---

### 发帖贴图（Cloudinary 图床 + 客户端压缩）

**背景：** 发帖支持上传图片。关键决策：**图片不进数据库**（DB 只存返回的 URL），客户端先压缩，二进制存到 Cloudinary 免费图床（自动压缩/CDN，跨设备与部署都能访问）。

**实现：**
- `lib/image.ts`：canvas 把图缩到最长边 1280、JPEG q0.8 重编码，显著减小体积
- `lib/cloudinary.ts`：unsigned upload preset 客户端**直传**（不经服务器），存 `secure_url` 并插入 `q_auto,f_auto` 交付优化；未配置时优雅报错
- `PostDialog`：图片选择 + 预览 + 移除；提交时压缩→上传→带 `imageUrl`；未配置图床时显示提示
- `createUserEvent` / `POST /api/events` / `MapExplorer.submitPost` 透传 `imageUrl`；`/me` 发帖卡片展示图片
- env 增加 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `_UPLOAD_PRESET`（均为可公开值，非密钥）

**涉及文件：** `src/lib/{image,cloudinary}.ts`、`src/components/Map/PostDialog.tsx`、`.../MapExplorer.tsx`、`src/services/events.ts`、`src/app/api/events/route.ts`、`src/components/Me/MeView.tsx`、`.env.example`

---

### 时间范围筛选 + 活动图片；地图区分打卡/发帖；个人页分 tab

**背景：** 三个功能需求。

**实现：**
1. **时间范围 + 过期默认隐藏**
   - Filters 日期段增加「本月」；新增「含过期」开关（默认关 → 过期活动不显示）
   - `FilterState` 加 `showExpired`；过期判定 = 结束时间（`endTime` 无则 `startTime`）早于现在，未定档不算过期
   - 地图 `filtered` 与推荐页都默认过滤过期；地图可用「含过期」临时显示
2. **活动图片（LLM 抽取）**
   - `Event` 加 `imageUrl` 字段（迁移 `add_event_image`）
   - `llm.ts` 抽取 tool/JSON schema + prompt 增加 `imageUrl`；`ingest` 落库；`EventDTO` 加字段
   - 推荐卡片、详情抽屉展示活动主图
3. **地图区分打卡 / 发帖**
   - 新增 `event-point-user` 图层：USER 发帖在圆心叠白点（靶心造型），与抓取活动（分类色实心）、打卡（琥珀实心）三者一眼区分
4. **个人页 打卡 / 发帖 两 tab**
   - 新增 `GET /api/events?mine=1` + `listUserEvents()`
   - `MeView` 改为两 tab：打卡（时间线）/ 发帖（卡片列表，含「在地图上查看」+ 删除）；顶部足迹地图按当前 tab 撒点

**涉及文件：** `prisma/schema.prisma`、`src/services/extraction/{types,ingest}.ts`、`.../sources/connpass.ts`、`src/lib/{llm,types}.ts`、`src/services/events.ts`、`src/app/api/events/route.ts`、`src/components/Map/{Filters,MapExplorer}.tsx`、`src/components/Me/MeView.tsx`、`src/app/{recommend,calendar}/page.tsx`、`src/components/Recommend/{RecommendList,EventDetail}.tsx`

---

### 文档：README 重写 + 协作工作流

- `README.md` 从过期的早期版本重写为反映当前功能（聚类、两动作 FAB、日历、天气、评论、删除、DeepSeek/Claude 可切换 LLM、4 tab）的完整说明，含快速开始（含 `prisma generate`）、环境变量、目录结构、路线图。
- `CLAUDE.md` 新增「协作流程（Git / 跨设备）」：换机先 `prisma generate`；每次功能完成后 `更新 CHANGELOG → commit → push origin main`；远端 `ChinSeihu/CloudFootPrints`。
- **约定**：今后每次功能新增/变更完成即提交并推送到 GitHub。

### 跨设备同步修复 + 构建清理

**背景：** 从另一台 PC 同步最新代码到本机后，先做环境对齐与编译修复，确保 `tsc` / `next build` 全绿，便于双机共享进度。

**实现：**
1. 本机首次启动运行 `prisma generate`（换设备必做，否则 `@prisma/client` 无 `PrismaClient` 导出、API 全 500）
2. 修复 `tsc` 报错：`MapExplorer.tsx` 的 `CATEGORY_COLOR_EXPR`（MapLibre `match` 表达式用 spread 动态拼分支，TS 无法核对精确元组）改为 `as unknown as maplibregl.ExpressionSpecification` 断言。该错误在 `next dev`（Turbopack 不跑严格 tsc）下不显现，但 `tsc --noEmit` / `next build` 会失败
3. 删除孤儿组件 `CheckInFab.tsx`（已被 `ActionFab` 速拨菜单取代，全项目无引用）；修正 `BottomNav.tsx` 指向它的过期注释
4. 确认 `npm run build` 全绿（9 路由）

**确认（同步版本已实现，本次未改动逻辑）：**
- **打卡聚类**：打卡用 GeoJSON cluster 图层，同址/邻近多次打卡合并为带数量的气泡，放大到 `clusterMaxZoom` 以上散开
- **打卡 / 发帖分两种动作**：FAB 速拨菜单（`ActionFab`）→ 打卡（`CheckInDialog`，个人足迹）或 发帖（`PostDialog`，创建 `sourceType=USER` 活动）

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — `CATEGORY_COLOR_EXPR` 类型断言
- `src/components/Map/CheckInFab.tsx` — 删除（孤儿）
- `src/components/BottomNav.tsx` — 过期注释更新

---

## 2026-06-09

### 活动日历 + 地址复制 + 地图天气面板

**背景：** 三个新功能——(1) 日历看当日活动；(2) 地址一键复制；(3) 地图天气入口 + 上层天气动画。

**实现：**
1. **活动日历 tab**
   - 底部导航从 3 tab 扩成 4 tab（地图/日历/推荐/个人），`grid-cols-4`
   - 新增 `/calendar`：月历网格，有活动的日期标分类色圆点（最多 3 个）；点某天 → 下方按时间列出当天活动；点活动 → 复用 `EventDetail` 详情抽屉
   - 活动按"东京时区当天"分组（`toLocaleDateString("en-CA", {timeZone:"Asia/Tokyo"})`）；未定档（无 startTime）的活动不进格子
2. **地址复制按钮**
   - 新增通用 `CopyButton` 组件 + `lib/clipboard.ts`（Clipboard API 失败回退 execCommand）
   - 详情抽屉地址行、地图弹窗卡片地址行各加复制图标，点击切换对勾反馈
3. **地图天气面板**
   - 数据源 Open-Meteo（免费无 key），服务端 `services/weather.ts` + `/api/weather`，半小时缓存；WMO code → 6 大类（晴/多云/雾/雨/雪/雷暴）
   - 地图天气按钮（缩放控件下方）显示当前温度；点开后底部出现可横向滑动的近 7 天卡片
   - 展开时地图上层播放天气动画（`WeatherAnimation`，按当前天气大类切换：雨线/雪花/云/阳光/雷闪），CSS keyframes，`pointer-events:none` 不挡交互
   - FAB 提到 `z-30`（高于天气卡片条 z-20），天气展开时仍可点

**涉及文件：**
- `src/components/BottomNav.tsx` — 4 tab
- `src/app/calendar/page.tsx` + `src/components/Calendar/CalendarView.tsx` — 新建日历
- `src/services/weather.ts` + `src/app/api/weather/route.ts` — 新建天气数据层
- `src/components/Map/WeatherPanel.tsx` + `WeatherAnimation.tsx` — 新建天气面板与动画
- `src/components/Map/MapExplorer.tsx` — 挂载 `WeatherPanel`；弹窗卡片加地址复制
- `src/components/Map/ActionFab.tsx` — z-10 → z-30
- `src/components/CopyButton.tsx` + `src/lib/clipboard.ts` — 新建复制能力
- `src/components/Recommend/EventDetail.tsx` — 地址行加复制按钮
- `src/components/icons.tsx` — 新增复制/对勾/翻页箭头/天气系列图标 + `WeatherIcon`
- `src/app/globals.css` — 弹窗地址行 flex 容纳复制按钮；天气动画样式 `.wx-*`

---

### 同位置堆叠卡片 + 强制亮色 + 聚合圆样式

**背景：** 三个体验问题——(1) 同址/极近的多个活动点击后看不全；(2) OS 夜间模式下页面翻黑、文字看不清；(3) 聚合圆纯白不醒目。

**实现：**
1. **堆叠卡片弹窗（活动）**
   - 点击单点：`queryRenderedFeatures` 取点击像素 ±14px 内所有点 → 去重 → 一个弹窗里上下排列多张卡片
   - 点击聚合圆：`getClusterLeaves` 取叶子，若坐标包围盒 < 0.0006°（约 60m）判为"挤在一起"，直接堆叠卡片；否则 `easeTo` 放大展开
   - 卡片信息更详细：分类色条 + 分类/时间 + 标题 + 场馆 + 地址 + 来源链接 / 删除按钮，整卡可点
   - 卡片点击 → `/recommend?event=<id>`，推荐页自动打开该活动详情抽屉
2. **强制亮色主题**：`globals.css` 移除 `@media (prefers-color-scheme: dark)`，加 `color-scheme: light`
3. **聚合圆重做**：活动聚合改实心蓝 + 白边 + 半透明蓝光晕 + 白字；打卡聚合加同款光晕

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — `eventsToFC` 增加 address/endTime 属性；新增 `event-cluster-halo`/`checkin-cluster-halo` 图层并重配聚合圆配色；重写 event-point/event-clusters 点击逻辑为 `openEventsPopup` 堆叠卡片；引入 `useRouter`
- `src/app/globals.css` — 强制亮色；新增 `.tem-*` 弹窗卡片样式；`.maplibregl-popup-content` padding 归零
- `src/components/Recommend/RecommendList.tsx` — 读 `?event=` 自动打开详情

---

### 环境修复：依赖安装 & Turbopack 启动问题

**问题1：** `npm install` / `yarn install` 始终装到 `next@9.5.5` 而非 `16.2.7`
- 根因：`package.json` 里 `next` 字段值写的是 `"^9.3.3"`，`16.2.7` 是 `eslint-config-next` 的版本
- 同时 `prisma` 版本写的是 `^6.19.3`，与 `@prisma/client@^7.8.0` 不匹配
- 修复：`"next": "16.2.7"`，`"prisma": "^7.8.0"`；删除遗留的 `package-lock.json` 和 `yarn.lock`，用 yarn 重新安装

**问题2：** 页面无限刷新 + Turbopack FATAL panic
- 根因1：`C:\Users\minyuan\package-lock.json`（2023年遗留，仅含 `node@20.7.0`）让 Turbopack 误判 workspace root 为用户目录，导致找不到 Next.js 包，HMR 不断 panic 重连 → 浏览器无限刷新
- 根因2：从未运行 `prisma generate`，`.prisma/client/default` 不存在，API 路由全部 500
- 修复：删除 `C:\Users\minyuan\package-lock.json`；运行 `yarn prisma generate`；`next.config.ts` 加入 `turbopack.root: process.cwd()`

**问题3：** 点击地图/个人 tab 始终跳回推荐页面
- 根因：`C:\Users\minyuan\package.json`（内容 `{"dependencies":{"node":"^20.7.0"}}`）仍然存在。Turbopack 把这个目录识别为 workspace root，找不到 Next.js → FATAL panic → HMR 触发浏览器全量刷新 → 落回最后编译成功的页面（/recommend）
- 修复：删除 `C:\Users\minyuan\package.json`，`turbopack.root` 改为 `process.cwd()`，清除 `.next` 缓存后重启
- **教训：** 如再次出现 "Next.js package not found" FATAL，先检查 `$HOME`（`C:\Users\<user>`）级别是否残留 `package.json` 或 `package-lock.json`

**注意：** 换设备后首次启动必须先运行 `yarn prisma generate`，否则所有 API 路由会报 500。

---

### 地图标记聚合（随比例尺缩放）

**背景：** 同一位置标记过多时视觉混乱，需要按比例尺合并。

**实现：**
- 将活动 markers 从 DOM `maplibregl.Marker` 改为 GeoJSON source + MapLibre 原生 cluster 图层
- `clusterMaxZoom: 14`，14 级以上散开显示单点；点击聚合气泡自动 `easeTo` 展开
- 单点样式：分类色填充圆（radius 9）+ 白色描边（2.5px），颜色通过 MapLibre `match` 表达式动态映射

**涉及文件：**
- `src/components/Map/MapExplorer.tsx` — 新增 `setupEventClusters()`，移除旧 DOM marker 渲染逻辑
- `src/components/Map/markers.ts` — 移除 `eventMarkerEl`、`checkinMarkerEl`、`spreadOffsets`，只保留 `anchorMarkerEl`

---

### 打卡/发帖删除功能

**背景：** v1 缺少删除自己内容的能力。

**实现：**
- 新增 `DELETE /api/checkins/[id]`：只允许删除 `userId === "me"` 的打卡
- 新增 `DELETE /api/events/[id]`：只允许删除 `sourceType === "USER"` 的发帖
- 地图点击弹窗底部增加红色"删除"按钮，删后自动刷新对应图层

**涉及文件：**
- `src/app/api/checkins/[id]/route.ts` — 新建，DELETE handler
- `src/app/api/events/[id]/route.ts` — 新建，DELETE handler
- `src/services/checkins.ts` — 新增 `deleteCheckin()`
- `src/services/events.ts` — 新增 `deleteUserEvent()`
- `src/components/Map/MapExplorer.tsx` — 弹窗 HTML 加入删除按钮，通过 ref 传递删除回调

---

### 地图标记现代化设计

**背景：** 原水滴针视觉风格偏旧，需更现代。

**实现：**
- 活动点改为分类色填充圆 + 白色描边（替代水滴针 SVG）
- 聚合圆改为白底 + 浅灰边框 + 深色数字
- 锚点针（拖拽）保留水滴造型，简化为扁平蓝色 + drop-shadow，去掉多余装饰

**涉及文件：**
- `src/components/Map/markers.ts` — 重写 `anchorMarkerEl()`
- `src/components/Map/MapExplorer.tsx` — 事件/打卡点渲染改为 circle 图层

---

### "我的"筛选 chip

**背景：** 需要快速过滤只看自己发帖/打卡，排除抓取的活动。

**实现：**
- `FilterState` 新增 `mineOnly: boolean` 字段
- Filters 组件末尾增加琥珀色"我的"chip（人形图标）
- `mineOnly` 激活时只显示 `sourceType === "USER"` 的活动；打卡层始终可见（v1 单用户全是自己的）

**涉及文件：**
- `src/components/Map/Filters.tsx` — 新增 mineOnly chip
- `src/components/Map/MapExplorer.tsx` — `filtered` useMemo 增加 mineOnly 过滤条件

---

## 2026-06-09（初始化）

### 项目初始搭建

- Next.js 16 + TypeScript + Tailwind v4 + Prisma 7 + MapLibre GL JS
- 实现地图页、推荐页（占位）、个人页
- 数据提取管线：connpass / 东京都开放数据 / 样例 fixtures → LLM 抽取 → GSI 地理编码 → 入库
- 提取质量 eval 框架（`scripts/eval-extraction.ts`）
- 底部三 tab 导航：地图 / 推荐 / 个人
- FAB 浮动操作按钮：打卡 + 锚点发帖
