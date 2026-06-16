# 修改履历

> 记录每次功能变更的内容、涉及文件、背景说明。时间倒序排列（最新在上）。

---

## 2026-06-16

### 景点卡片配图（真实维基图 + Lightbox 左右滑）

- **拉图脚本** `scripts/fetch-landmark-images.mjs`：从日文维基 `media-list` API 为 26 个景点拉**真实**图片（Wikimedia 缩略图，过滤掉图标/地图/svg/徽标，带限速退避重试），生成 `src/lib/landmarkImages.ts`（25/26 有图，共 119 张；仅 teamLab Planets 未命中）。绝不编造 URL，已验证可加载（HTTP 200）。
- **景点弹窗**顶部加封面图（多图显示「N 张」角标），点击 → **Lightbox 全屏左右滑**（复用 `components/common/Lightbox`）。原生地图弹窗的图通过 `openLightboxRef` 桥接到 React 状态。
- `landmarksToFC` 的 properties 补 `cover`/`images`。

**涉及文件：** `scripts/fetch-landmark-images.mjs`、`src/lib/landmarkImages.ts`（新）、`src/components/Map/MapExplorer.tsx`

---

### 隐藏 OSM 美食层 + 精选店「AI 精选」标识

- **隐藏 OSM 美食**：OSM 全量美食信息不全（无评分/照片/营业时间），用开关 `SHOW_OSM_FOOD=false` 暂隐藏，着重 Hot Pepper；筛选联动/视野懒加载代码本就有 `getLayer`/`getSource` 守卫，自动跳过，不再请求 `/api/food`。
- **AI 精选标识**：人工/AI 精选店（有评分 `rating`）→ 地图图标右上角**紫色星角标**（`foodpick-<kind>` 变体，与 Hot Pepper「有照片」的相机角标区分）；点击卡片标题加**「✨AI精选」紫色徽章**。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

## 2026-06-15

### 美食铺开全 23 区 + Hot Pepper(有照片)相机角标

- **铺开 23 区**：`scripts/import-osm-food.ts` 改为对东京 23 区外包围盒**网格平铺**（0.04°≈4km 一片，约 80 片）逐片拉取，带限流退避重试；osmId upsert 自动跨片去重。一次跑通全 23 区。
- **有照片特殊标识**：Hot Pepper 导入的店（带 `photo`）在地图图标右上角加**相机角标**（`foodfeat-<kind>` 变体图标），与普通点/ OSM 点区分；`featured` 由「是否有照片」派生，`food-icon` 用 `case` 表达式选图标。

**涉及文件：** `scripts/import-osm-food.ts`、`src/components/Map/MapExplorer.tsx`

---

### 美食全量底图：接入 OpenStreetMap（试点）

Hot Pepper 覆盖有限（仅广告合作店、缺大量外国餐厅）。引入 OSM(Overpass) 作为「全量底图」，精选 + Hot Pepper 作亮点叠加。本次为试点（涩谷/新宿/银座三区，跑通整条链路）。

- **数据库**：新增 `FoodPoi` 表（osmType+osmId 唯一、name/nameEn/kind/cuisine/经纬度/营业时间/电话/官网/外带/无障碍/地址）。
- **导入脚本** `scripts/import-osm-food.ts`：Overpass 按区 bbox 拉 restaurant/cafe/fast_food，`cuisine→kind` 映射（`lib/cuisineMap.ts`），按 osm id upsert。仅涩谷一区即 ~1048 家。
- **菜系**：`FoodKind` 加 `other`（装韩/泰/印/越等外国餐厅）+ 图标/配色/筛选项。
- **服务/接口**：`services/foodPoi.ts` + `GET /api/food?bbox`（按地图视野查询，限 800）。
- **地图**：新增 `osmfood` 图层——按视野懒加载（zoom ≥ 13.5 才拉、≥14 才显示）、菜系图标 + 店名标签、点击弹简卡（菜系/营业/电话/官网/外带·无障碍 + 问 AI）；随美食筛选开关联动。无评分/照片（OSM 不含）。

**涉及文件：** `prisma/schema.prisma`、`src/lib/{cuisineMap,foodSpots}.ts`、`scripts/import-osm-food.ts`、`src/services/foodPoi.ts`、`src/app/api/food/route.ts`、`src/components/Map/MapExplorer.tsx`

---

### 地图视觉降噪优化

地图同时有活动聚合/单点、百余美食点、景点、打卡，信息偏杂。优化：

- **分层按缩放显示**：美食图层 `minzoom 12.5`、景点图层 `minzoom 11.5`——缩小时只见活动聚合，放大才出现美食/景点，逐级展开。
- **标签分色降噪**：活动摘要保持红色突出；美食标签改柔和玫红 `#a65a6e`、景点改柔褐 `#8a7a6b`，字号 13→11.5，halo 2→1.5，淡入更晚（美食 13.5→14.2、景点 13→13.6），并加 `text-padding` 减少碰撞，避免满屏红字。
- **聚合点更灵动**：主圆配色更柔（浅蓝渐变）、白边更轻薄（2→1.5、透明度 0.85→0.7）；呼吸动效放慢更柔和（周期 650→1100ms），主圆新增极轻微呼吸缩放（×1.0→×1.035）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 报名活动展示 + 发帖/打卡编辑功能

- **报名活动**：个人页「收藏」tab 改为「收藏 / 报名」二级切换，新增展示当前用户报名过的活动。
  - 新增 `listSignupEvents`（复用 `listEventsByReaction` 泛化）+ `GET /api/signups`。
- **编辑发帖**（仅作者，文字信息，不动坐标/图片）：标题/分类/简介/地点名/时间/标签/报名开关。
  - `updateUserEvent` 服务（鉴权：USER 来源 + 作者）+ `PATCH /api/events/[id]`。
- **编辑打卡**（仅本人）：备注/评分/照片（保留+增删）/时间。
  - `updateCheckin` 服务 + `PATCH /api/checkins/[id]`。
- **UI**：发帖/打卡列表加「编辑」按钮；新增 `Me/EditDialogs.tsx`（居中模态，区别于地图底部 sheet），复用日期选择/图片上传逻辑。

**涉及文件：** `src/services/{reactions,events,checkins}.ts`、`src/app/api/signups/route.ts`、`src/app/api/events/[id]/route.ts`、`src/app/api/checkins/[id]/route.ts`、`src/components/Me/EditDialogs.tsx`、`src/components/Me/MeView.tsx`

---

### 精选名店详细信息补全

最初手工精选的 ~21 家名店字段比 Hot Pepper 导入店少，卡片简陋。补全：

- **数据结构**：`FoodSpot` 加可选 `budget`（参考人均）/ `station`（最寄駅）/ `tips`（预约·营业贴士）；`FoodSpotView` 加 `tips`。
- **数据**：为全部 21 家补上最寄駅、参考人均（约值）、更完整的简介（主厨/背景/看点），名店补预约贴士（如「完全予约制」「极难预约」）。照片未加——米其林级名店无可靠免费图源，不编造 URL。
- **卡片**：人均 💴 移到信息行（精选/导入都展示），新增 💡 贴士行；AI 导览上下文也带上人均/贴士。

**涉及文件：** `src/lib/foodSpots.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

### 抓取管线 LLM 生成活动一句话摘要（存 Event.summary）

地图标签用活动 description 直接截取效果差（冗长/缺失）。改为在抓取管线里用 LLM 为每条活动生成一句 ≤14 字短摘要，存入新字段，地图标签优先用它。

- **数据库**：`Event.summary String?`（db push 到 Neon）。
- **管线**：新增 `services/extraction/summarize.ts`（`maybeSummarize`，开关 `SUMMARIZE_WITH_LLM=true` + 有 LLM key 才启用，失败静默回退 null），在 `index.ts` 对所有源的活动执行；`lib/llm.ts` 加 `summarizeEvents`（批量 30 条，DeepSeek/Anthropic 双 provider，硬截 14 字）。
- **入库 / DTO**：`ingest.ts` 写入 summary；`ExtractedEvent`、`EventDTO` 加 summary，相关页面/接口 DTO（recommend/calendar/favorites/events[id]）补字段。
- **地图标签**：活动摘要优先级 `summary → description → 分类名 → 标题`。
- **定时任务**：`.github/workflows/extract.yml` 加 `SUMMARIZE_WITH_LLM=true`。
- 实测（DeepSeek）：チームラボ→「teamLab沉浸光影展」、隅田川花火→「隅田川夏夜花火」、東京蚤の市→「东京古董市集」、草間彌生展→「草间弥生回顾展」。

**涉及文件：** `prisma/schema.prisma`、`src/lib/llm.ts`、`src/lib/types.ts`、`src/services/extraction/{summarize,index,ingest,types}.ts`、`src/services/extraction/sources/{jsonLd,connpass}.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/recommend/page.tsx`、`src/app/calendar/page.tsx`、`src/app/api/favorites/route.ts`、`src/app/api/events/[id]/route.ts`、`.github/workflows/extract.yml`

---

### 放大后显示简介标签（活动 / 美食 / 景点）

地图放大到一定缩放级别后，在图标下方显示一句摘要标签（超出截断加省略号，用 MapLibre 表达式渲染时截断，不改数据）：

- **活动**：原本单点无文字，现在 `event-glyph` 层加上摘要标签（zoom 14→14.6 淡入）。
- **美食 / 景点**：原本显示会换行的全名，改为单行摘要。
- **摘要来源（不再直接截标题）**：活动用 `description`（缺省退回分类名）；美食 / 景点用各自的 `blurb` 一句话简介。
- **样式更醒目**：文字偏红 `#d6336c`、字号 13、白色描边加粗（halo 2）。字体保留 Open Sans Regular（CARTO glyph 服务该字重含 CJK，Bold 可能缺 CJK 字形）。

**涉及文件：** `src/components/Map/MapExplorer.tsx`

---

### 美食卡片丰富 + AI 导览加「店铺评价」

- **AI 导览**：餐厅快捷问题新增「口碑和评价怎么样？」「适合什么场合（约会/聚餐/一人/商务，シーン）」；并把店铺资料（评分/预算/最近车站/设施/招牌语）注入对话上下文，评价更贴合该店。
- **地图美食卡片丰富**：拉取脚本补抓 Hot Pepper 更多真实字段（最寄駅 `station_name`、营业时间 `open`、設施 `card`/`non_smoking`/`wifi`/`private_room`/`lunch`）。卡片新增：📍最寄駅、🕒营业时间、设施标签（個室/禁煙席/Wi-Fi/カード可/ランチ）。

**涉及文件：** `scripts/fetch-hotpepper.ts`、`scripts/build-foodspots.ts`、`src/lib/foodSpots.ts`、`src/lib/foodSpotsImported.ts`、`src/components/Guide/GuideChat.tsx`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`

---

### 美食扩充：Hot Pepper API 导入 + 人工精选混合

之前美食点只有 ~21 家纯人工精选，店少信息少。改为「Hot Pepper Gourmet API 拉真实候选池 → 精选 → 入库」的混合模式：

- **拉取脚本** `scripts/fetch-hotpepper.ts`（`npm run fetch:hotpepper`，需 `HOTPEPPER_API_KEY`）：按 7 个菜系（和食/焼肉/ラーメン/中華/洋食/伊法/カフェ・スイーツ）各拉东京 100 家，输出候选池 `scripts/hotpepper-candidates.json`（已 gitignore）。
- **精选脚本** `scripts/build-foodspots.ts`：从候选池按菜系配额 + 地理打散（~1.2km 网格去重，避免堆在同一商圈）精选 ~139 家，拆分咖啡/甜品，生成 `src/lib/foodSpotsImported.ts`。
- **数据结构**：`FoodSpot`（人工精选，带参考评分+招牌菜）+ 新增 `FoodSpotImported`（导入店，带预算/照片/官网链接，**无评分**——Hot Pepper API 不提供评分）+ 合并视图 `FoodSpotView` / `FOOD_SPOTS_ALL`。
- **地图卡片**：导入店展示**店铺照片 + 预算 + 招牌语 + Hot Pepper 详情链接**；精选名店仍显示参考评分。
- 说明：用户在 Hot Pepper 网页看到的「料理・味/雰囲気」评分百分比来自网页口コミ，官方 API 不含，故导入店不显示评分。

**涉及文件：** `scripts/fetch-hotpepper.ts`、`scripts/build-foodspots.ts`、`src/lib/foodSpots.ts`、`src/lib/foodSpotsImported.ts`、`src/components/Map/MapExplorer.tsx`、`src/app/globals.css`、`package.json`、`.gitignore`

---

## 2026-06-14

### 新增演唱会数据源（walkerplus ライブ）

接入 walkerplus 东京「ライブ・音楽イベント」子分类 `ar0313/eg0109`（复用 walkerplus 工厂，分类强制 `LIVE`，默认 6 页，可用 `WALKERPLUS_LIVE_MAX_PAGES` 调）。跑 `npm run extract` 拉入演唱会/音乐活动。

**涉及文件：** `services/extraction/sources/walkerplus.ts`、`services/extraction/sources/index.ts`

---

### 发帖报名模式

- **数据库**：`Event.signupEnabled`（发帖可开启）；`ReactionType` 加 `SIGNUP`（复用 Reaction 系统，报名=一条 SIGNUP reaction）。db push 到 Neon。
- **发帖表单**：新增「开启报名」开关。
- **详情页**：开启报名的活动顶部显示「报名参加 / 已报名·点击取消」按钮 + 报名人数；乐观更新、未登录提示登录。
- 服务/接口：`getReactionState` 增加 `signupCount/signedUpByMe`；`/reactions` POST 允许 `SIGNUP`；`EventDTO.signupEnabled` + 各 page/route/createUserEvent 贯通。

**涉及文件：** `prisma/schema.prisma`、`lib/types.ts`、`services/{reactions,events}.ts`、`app/api/events/[id]/reactions/route.ts`、相关 page/route、`components/Map/PostDialog.tsx`、`components/Map/MapExplorer.tsx`、`components/Recommend/EventDetail.tsx`

---

### 加载优化：推荐懒加载 + 推荐/日历 ISR 缓存 + 个人页骨架

- **推荐页懒加载**：瀑布流先渲染 12 张，`IntersectionObserver` 触底再加 12，减少首屏 DOM、加快渲染。
- **推荐/日历 ISR 缓存**：从 `force-dynamic` 改 `revalidate=3600`（数据每日定时更新，1h 缓存即可），避免每次请求都查库，显著加快加载。
- **个人页加载骨架**：数据拉取期间显示灰色骨架（照片拼图 + 列表），消除「空白一会才出现」。

**涉及文件：** `components/Recommend/RecommendList.tsx`、`app/recommend/page.tsx`、`app/calendar/page.tsx`、`components/Me/MeView.tsx`

---

### 修复：删除确认用 `window.confirm` 在部分 webview 误删

- **现象**：连续「删除→取消」循环时仍会被删除。**根因**：部分移动端 webview 的 `window.confirm()` 行为不可靠（点「取消」也可能返回 true）。
- **修复**：新增应用内 `ConfirmDialog`（受控弹窗、取消/确认明确回调），替换发帖/打卡删除处的原生 `confirm()`（个人页 + 地图弹窗）。实测「删除→取消」循环不再误删，确认才删。

**涉及文件：** `components/common/ConfirmDialog.tsx`、`components/Me/MeView.tsx`、`components/Map/MapExplorer.tsx`

---

### 聚合圆按「地理分散度」定大小（同点不放大）

聚合圆半径从「按数量」改为「按聚合内各点的经纬包围盒边长」：**同一地点的多个活动 → spread≈0 → 小圆**（如皆在皇居受付的多场马拉松，不再撑成巨型圈）；**不同地点分散 → 越散越大**。实现：source 加 `clusterProperties`(min/max lng·lat) → 半径用 `interpolate(spread)`（主圆 15→27、光晕 22→38）；呼吸动效仍在此基础上脉动。`eventsToFC` 的 properties 补 `lng/lat` 供聚合统计。

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 多图上传 + 图片点击放大；AI 导游按类型给选项

- **AI 导游分类型快捷问题**：`GuideTopic` 加 `kind`（event/landmark/food），快捷问题随类型变——餐厅问招牌/预算/周边、景区问看点/路线/周边、活动问看点/路线/类似推荐。名胜→landmark、美食→food、活动默认 event。
- **多图上传**：`Event.imageUrls` / `CheckIn.photoUrls`（`String[]`，保留单值字段作封面=首图）。发帖/打卡表单改为**多图网格 + 添加格**（最多 6 张，客户端压缩后并行上传）。db push 到 Neon。
- **图片点击放大**：新增 `Lightbox`（全屏查看、× / Esc 关闭、多图左右切换 + 序号）。详情页图片（单图大图 / 多图九宫格）与个人页打卡照片均可点开放大。
- DTO（`EventDTO.imageUrls` / `CheckInDTO.photoUrls`）+ 各 service/route/page 贯通。

**涉及文件：** `prisma/schema.prisma`、`lib/types.ts`、`components/common/Lightbox.tsx`、`components/Guide/*`、`components/Map/{PostDialog,CheckInDialog,MapExplorer}.tsx`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`services/{events,checkins}.ts`、相关 route/page

---

### 去掉手动刷新（改每日定时更新）+ 修复时间筛选后顶栏错乱

- **修复样式错乱**：选了日期范围后标签变长（如「6月1日 – 6月30日」），顶部行 flex 把「筛选/刷新」挤到换行、整行错乱。改为 `flex-wrap` + 各按钮 `shrink-0 whitespace-nowrap`：放不下时整块换行，不再挤乱。
- **移除手动「刷新」按钮**：数据全用户共享、无需手动刷新。
- **每日定时更新（GitHub Actions）**：抓取全流程要几分钟，会超过 Vercel 函数超时（Hobby 60s / Pro 300s），故**不走 Vercel Cron**，改用 **GitHub Actions**（`.github/workflows/extract.yml`，每日 `0 18 * * *` UTC = 凌晨 3 点 JST）直接跑 `npm run extract` 连 Neon 入库，无超时、可手动触发。`/api/extract` 仍保留 **GET/POST + `CRON_SECRET` 鉴权**，供需要时手动触发。

**涉及文件：** `components/Map/Filters.tsx`、`components/Map/MapExplorer.tsx`、`app/api/extract/route.ts`、`vercel.json`

---

### 美食按菜系分图标 + 菜系筛选 + 左下控件下移

- **菜系图标**：美食 POI 按 `kind`（日式/中餐/西餐/咖啡/甜品）用不同图标 + 配色（`FOOD_KIND_META`）；补齐中餐(茶禅華/麻布長江)、咖啡(Blue Bottle/猿田彦)、甜品(HIGASHIYA/資生堂)等，共 21 家。
- **美食筛选**：左下「🍜 美食」点开下拉，可选 全部 / 各菜系 / 不显示（MapLibre `setFilter` 按 kind 过滤 + 显隐），选择持久化。
- **左下控件下移 + 横排**：底图风格 / 景点 / 美食 从竖向堆叠（最高到 192px）改为底部一横排（`bottom-7`），更靠下、不挡地图中部。

**涉及文件：** `lib/foodSpots.ts`、`components/Map/MapExplorer.tsx`、`components/Map/StyleSwitcher.tsx`

### 精选美食 POI 层（评分>4.0 + 招牌菜单）

新增「美食」图层（类似名胜，**常驻 POI 非带时间活动**）：

- **精选数据** `lib/foodSpots.ts`：人工精选东京 14 家评分>4.0 名店（次郎/さいとう/龍吟/傳/かんだ/NARISAWA 等），各带菜系、评分、招牌菜单、简介。
- **地图图层**：玫红叉勺图标 + 名称标注；点击弹**美食卡**（暖玫色，与活动/名胜卡区分）：名称 + 菜系 + ★评分 + 简介 + 招牌菜单标签 + 「问 AI 导游」。左下角「🍜 美食」开关显隐（持久化）。
- **说明**：评分/菜单为**人工精选标注**。实时抓取评分>4.0+菜单不可行——食べログ禁爬、Google Places 需付费且 ToS 限制入库、Hot Pepper 免费 API 无评分（见对话），故采用精选方案。

**涉及文件：** `lib/foodSpots.ts`、`components/Map/MapExplorer.tsx`、`app/globals.css`

---

### 时间筛选移到顶部计数右侧

地图页时间筛选 chip 从「筛选」展开面板里**移到顶行**（计数「N个活动中」右边），点击直接弹日历，更显眼易达；展开面板里只保留「含过期」。

**涉及文件：** `components/Map/Filters.tsx`

---

### 收紧地图聚合范围

活动/打卡聚合 `clusterRadius` 48/46 → **36**，`clusterMaxZoom` → 15：邻近但不同地点的活动更早分开、整体不那么密集，放大到 15 级即全部散为单点。（同一坐标的活动——如皆在「皇居受付」的多场马拉松——仍会聚成一团，点击弹堆叠卡片逐个查看。）

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 新增体育（SPORTS）分类 + 体育数据源

- **新增分类 SPORTS**（体育/スポーツ，色 `#0d9488` 青绿，奖杯图标）：贯通 Prisma 枚举、`lib/categories`、`categoryIcons`、地图色表、关键词分类器（マラソン/ラン/野球/サッカー/ヨガ/試合…）、LLM 抽取与重分类提示。地图筛选 / 推荐 / 日历的分类 chip 自动出现。
- **体育数据源** `walkerplus-sports`：walkerplus 东京体育子分类 `ar0313/eg0108`（约 50+ 条）。把 walkerplus 抓取逻辑重构为工厂，复用同一套两步抓取；体育源分类**强制 SPORTS**。默认 6 页，可用 `WALKERPLUS_SPORTS_MAX_PAGES` 调整。
- 跑 `npm run extract` 即拉入体育活动（dedup 防重复）。

**涉及文件：** `prisma/schema.prisma`、`lib/categories.ts`、`lib/categoryIcons.ts`、`lib/llm.ts`、`components/Map/MapExplorer.tsx`、`services/extraction/sources/jsonLd.ts`、`services/extraction/sources/walkerplus.ts`、`services/extraction/sources/index.ts`

---

### 个人页发帖可点进详情（含过期活动）

个人页「发帖」卡片改为可点击 → 打开活动详情（图片+内容区为点击区，「在地图上查看/删除」独立成底部行，避免按钮嵌套）。详情用本地已加载的 DTO 直接打开，**过期活动同样可跳转**（`listUserEvents` 不做过期过滤）。

**涉及文件：** `components/Me/MeView.tsx`

---

### 日历页活动列表加分类筛选

日历页网格下方新增分类 chip（全部 + 各分类，柔和风格、横向滚动），筛选联动「当天开始 / 展期中」的计数与清单（按 `category` 过滤 `byDate` 分组）。

**涉及文件：** `components/Calendar/CalendarView.tsx`

---

### 消息已读/未读 + 点击定位 + 背景图 url() 修复

- **未读计数**：「消息」tab 徽章改为**未读数**（按 `localStorage` 记录的「最后已读时间」计），点开消息 tab 即标记已读 → 徽章归 0。
- **红色徽章**：`CountBadge` 增加 `red` 常驻红色调，用于消息未读提示。
- **点击定位**：消息条目可点击 → 拉取对应活动（新增 `GET /api/events/[id]` + `getEventById`）并打开详情。
- **修复背景图不显示**：`encodeURIComponent` 不转义括号，稻草堆等带 `()` 的文件名让无引号 CSS `url()` 解析中断 → 资料卡背景图（含默认稻草堆）不显示。给 `url("...")` 加引号修复。

**涉及文件：** `components/Me/MeView.tsx`、`components/Me/ProfileHeader.tsx`、`components/common/CountBadge.tsx`、`services/events.ts`、`app/api/events/[id]/route.ts`

---

### 推荐页筛选样式优化（对齐个人页风格）

分类 / 时间 chip 从描边样式改为**柔和灰底无边**（`bg-neutral-100`），激活态用实色填充 + 阴影（全部/时间=蓝，分类=分类色），与个人页分段控件一致；日历下拉改 `rounded-2xl` + 软阴影，更现代。

**涉及文件：** `components/Recommend/RecommendList.tsx`

---

### 绚烂风景背景 + 打卡删除 + 楼中楼 @回复

- **预设背景换为绚烂风景画**：`lib/covers.ts` 改用莫奈风景（稻草堆·夏末 / 罂粟花田 / 圣拉扎尔火车站 / 春日 / 干草堆 / 日出·印象），均验证可加载；`ensureDemoUser` 改为登录时同步预设背景（demo 账号是固定展示形象），5 个测试账号各配一幅；默认背景=稻草堆。
- **个人页打卡删除**：打卡时间线每条加「删除」（二次确认 → `DELETE /api/checkins/[id]` → 同步移除，照片拼图随之更新）。
- **楼中楼 @回复**：评论 `parentId` 改存**实际回复目标**（不再折叠到顶层）；详情页按根分组平铺，回复到「回复」时显示「@目标：内容」。被 @ 的人因 parentId 指向其评论而**自动收到「消息」通知**（验证：A→B→C 三层，B 的作者收到 C 的回复）。删除评论级联移除整棵子树。

**涉及文件：** `lib/covers.ts`、`services/users.ts`、`components/Me/MeView.tsx`、`components/Recommend/EventDetail.tsx`

---

### 个人页：足迹地图换成打卡照片拼图 + 莫奈预设背景

- **打卡照片拼图**：个人页顶部的「足迹地图」替换为**打卡照片网格**（取打卡上传的照片，最多 9 张，1/2/3 列自适应；无照片时占位提示）。顺带移除 MeView 的 MapLibre 依赖，更轻量。
- **莫奈预设背景**：`lib/covers.ts` 收录 6 幅莫奈公有领域作品（Wikimedia Commons，已验证可加载）。资料卡编辑里可从预设缩略图一键选择背景，或继续自定义上传。
- **测试账号背景**：5 个 demo 账号各配一幅莫奈背景（`demoUsers.ts`）；`ensureDemoUser` 对老账号补背景（仅当为空，不覆盖手动设置）。
- **新用户默认背景**：注册时默认给「睡莲」背景（`registerUser` 写入 `DEFAULT_COVER`）。

**涉及文件：** `lib/covers.ts`、`lib/demoUsers.ts`、`services/users.ts`、`components/Me/MeView.tsx`、`components/Me/ProfileHeader.tsx`

---

### 修复页面级滚动条（根因）+ 资料卡自定义背景图

- **页面级滚动条**：根因是文档根 `html` 仍可滚动（body 虽 `overflow-hidden`）。globals.css 给 `html` 加 `overflow:hidden` + `overscroll-behavior:none`，并撤掉先前 MeView 上隐藏滚动条的临时补丁，恢复内部正常滚动。
- **资料卡背景图**：`User` 加 `coverUrl`（Cloudinary）。编辑资料里可「更换背景 / 移除背景」（客户端压缩后上传，与头像同管线）；卡片以背景图渲染并压暗色渐变遮罩、文字转白，保证可读。贯通 `lib/auth`(PublicUser) / `services/users`(ProfileUpdate) / `/api/auth/profile` / `AuthContext`(AuthUser)。

**涉及文件：** `app/globals.css`、`prisma/schema.prisma`、`lib/auth.ts`、`services/users.ts`、`app/api/auth/profile/route.ts`、`components/Auth/AuthContext.tsx`、`components/Me/ProfileHeader.tsx`、`components/Me/MeView.tsx`

---

## 2026-06-13

### 个人页：资料卡片化 + 隐藏外层滚动条

- **资料栏卡片化**：`ProfileHeader` 从平铺改为**渐变卡片**（蓝→白→玫粉 + 角落柔光 + 阴影），头像放大加白环，常住地做成胶囊 chip，更突出。
- **外层滚动条**：Me 页外层容器加 `[scrollbar-width:none]` + `::-webkit-scrollbar` 隐藏（保留滚动），消除生硬的滚动条视觉（与 BottomSheet 一致）。

**涉及文件：** `components/Me/ProfileHeader.tsx`、`components/Me/MeView.tsx`

---

### 评论回复 / 删除 + 个人页「消息」

- **数据库**：`Comment` 加自关联 `parentId`（回复目标，顶层为 null；级联删除回复）。db push 到 Neon。
- **回复**：详情页评论线程化（顶层评论 + 缩进回复），每条带「回复」；回复保持一级（回复"回复"时挂到同一顶层）。输入区显示「回复 @某人 · 取消」。
- **删除**：评论作者可删自己的评论（`DELETE /api/comments/[id]`，仅作者，级联删回复）。
- **个人页「消息」tab**（第 4 个 tab，铃铛图标 + 计数）：展示**被回复**——① 别人回复了我的评论（带我原评论引用）；② 别人评论了我的帖子；显示对方、内容、所在活动、时间。
- 服务/接口：`services/replies.ts` + `GET /api/replies`；`comments` 服务加 `parentId`/`deleteComment`；`CommentDTO.parentId` + `ReplyNoticeDTO`；新增 `IconBell`。

**涉及文件：** `prisma/schema.prisma`、`services/comments.ts`、`services/replies.ts`、`app/api/comments/[id]/route.ts`、`app/api/replies/route.ts`、`app/api/events/[id]/comments/route.ts`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`components/icons.tsx`、`lib/types.ts`

---

### 发帖时间改为必选

发帖的「开始时间」必填（否则无法按时间筛选）：表单标 `*`、未选禁用发布并提示，`POST /api/events` 同步校验。

**涉及文件：** `components/Map/PostDialog.tsx`、`app/api/events/route.ts`

---

### 聚合点呼吸动效增强

聚合光晕的「呼吸」从仅透明度微动 → **透明度 + 半径一起脉动**（opacity 0.12–0.28、半径 ×1.0–1.2），效果更明显；半径在基础 step 表达式上乘时间系数，保留按数量分级。实测平滑无卡顿。

**涉及文件：** `components/Map/MapExplorer.tsx`

---

### 景点改为「介绍卡 → 确认问 AI」

点击景点不再直接跳 AI，而是先弹一张**名胜介绍卡**：

- `Landmark` 加 `blurb`（一句话简介），每个地标补中文简介。
- 点击地标 → MapLibre 弹出 `.tem-lm` 卡：类型徽章 + 名称 + 「名胜·类型」+ 简介 + 紫色「问 AI 导游了解更多」按钮；点按钮才唤起 AI 并锁定该名胜。
- **与活动卡视觉区分**：暖色渐变底（活动卡为白底 + 分类色条），暖色弹窗阴影与尖角。

**涉及文件：** `lib/landmarks.ts`、`components/Map/MapExplorer.tsx`、`app/globals.css`

---

### 日历调整：格子只显示节日、活动按「当天开始/展期中」分组

- **格子去掉「N场」数量**：底部只显示节日名（红日子，截断显示），不再显示活动数量。
- **选中日活动分两组 + tab 切换**：「当天开始」（start 日期=当天）/「展期中」（更早开始、当天仍在展期的长期活动），各带计数；切换日期时自动落到有内容的分组。解决长期展览每天都计入导致数量虚高、清单冗杂的问题。

**涉及文件：** `components/Calendar/CalendarView.tsx`

---

### 地图细节优化：聚合更柔和、景点可问 AI、人气活动按锚点

- **聚合点更柔和/灵动**：主圆从饱和蓝（#2563eb）改为按数量渐变的柔和periwinkle蓝（#9cc0f7→#6b8ee0）+ 半透明 + 柔白边；外层光晕加 blur 并做轻微「呼吸」动效（rAF 只改 halo 透明度）；单点加分类色柔光垫底、降透明，弱化突兀。
- **景点可点击问 AI**：点击地标 → 唤起 AI 导游并锁定该名胜（标题/看点/路线/周边）；景点图标尺寸略放大（0.62→0.98）。
- **人气活动按锚点**：原以屏幕中心算距离 → 改为**点击地图空白处落「探索锚点」**（玫红脉冲标记），人气卡片标题变「锚点周边」、按锚点重算最近活动与距离，可「重置」回屏幕中心。空白点击会避开活动/打卡/景点要素与发帖放置态。

**涉及文件：** `components/Map/MapExplorer.tsx`、`components/Map/PopularCard.tsx`、`app/globals.css`

---

### 活动标签（tag）管理：推荐卡片显示标签、发帖可加标签

- **数据库**：`Event` 加 `tags String[] @default([])`。db push 到 Neon（改 schema 后 dev server 需重启）。
- **标签工具** `lib/tags.ts`：`displayTags`（优先人工标签，抓取来源按关键词派生：免费/需购票/需预约/亲子/夜场/限定/体验/户外/室内/美食/音乐）、`normalizeTags`（清洗用户输入）。
- **推荐卡片**：去掉冗长说明文字，改为显示标签 chip（`#xxx`），更清爽。
- **发帖表单**：新增标签输入（回车/按钮添加、chip 可删、最多 8 个），随发帖入库。
- **详情页**：简介下也展示标签。
- DTO（`EventDTO.tags`）+ 各 page/route map 补 `tags`；`createUserEvent` 接收 tags。

**涉及文件：** `prisma/schema.prisma`、`lib/tags.ts`、`lib/types.ts`、`services/events.ts`、`app/api/events/route.ts`、`app/recommend/page.tsx`、`app/calendar/page.tsx`、`app/api/favorites/route.ts`、`components/Recommend/RecommendList.tsx`、`components/Recommend/EventDetail.tsx`、`components/Map/PostDialog.tsx`、`components/Map/MapExplorer.tsx`

---

### 个人页选项卡化（分段控件）

打卡/发帖/收藏三 tab 从下划线样式改为**分段控件**（圆角灰底容器 + 选中白底蓝字带阴影 + 图标 + 计数），更有设计感。

**涉及文件：** `components/Me/MeView.tsx`

---

### 日历：节假日标注 + 活动数量替代圆点

- **日本祝日**（`lib/holidays.ts`，2025–2027 含振替休日/国民の休日/春分秋分）：日历格红日子浅红底 + 红字；选中日在清单标题显示「🎌 节日名」。
- **传统配色**：周日 / 节假日红、周六蓝（仿日本日历）。
- **圆点 → 数量**：原分类色圆点改为显示当天活动数（「N场」），更直观。

**涉及文件：** `lib/holidays.ts`、`components/Calendar/CalendarView.tsx`

---

### 名胜 / 地标 / 公园 标识

在地图上标识主要景点（插画风固定底图做不了，先用图标渲染景点）：

- **精选数据** `lib/landmarks.ts`：~26 个东京知名地标（东京塔/晴空塔、浅草寺/明治神宫、上野公园/新宿御苑、皇居、各大博物馆美术馆、涩谷/东京站等），分 6 类（塔/神社寺/公园/城宫/博物馆/名胜），各类配色 + 白色线性图形。
- **地图图层**（`MapExplorer`）：独立 `landmarks` GeoJSON source + symbol 图层，自定义彩色徽章图标（按 kind）+ 名称标注（zoom≥13 才显示、带描边、碰撞避让）。图层加在活动层**之下**，不干扰活动聚合点击。
- **显隐切换**：左下角「🏯 景点」开关，状态持久化到 `localStorage`（默认显示）。

**涉及文件：** `lib/landmarks.ts`、`components/Map/MapExplorer.tsx`

---

### 柔和马卡龙底图风格（可切换）+ 人气活动卡片

参考用户给的插画风地图 mockup。说明：满地手绘樱花/树 + 3D 地标属美术渲染的固定插画地图，真实可交互矢量瓦片无法等价实现；本次落地「柔和水彩氛围 + 人气卡片」方向。

- **柔和主题**（`lib/mapTheme.ts`）：对现有 Positron 矢量图层**就地重着色**（`setPaintProperty`，不调 `setStyle`，故聚合/打卡等自定义图层不被清掉）——暖奶油陆地、柔蓝水域、柔绿公园、白色道路、柔和标注。切回「标准」时从记录的原始 paint 还原。
- **风格切换器**（`Map/StyleSwitcher.tsx`）：左下角「标准 / 柔和」切换，选择持久化到 `localStorage`，默认柔和。应用时机用「就绪标记 + effect」避免闭包捕获旧 theme。
- **人气活动卡片**（`Map/PopularCard.tsx`）：按距地图中心的球面距离取最近 3 个活动，显示分类图标 + 标题 + 距离，可折叠；点条目跳详情、「查看全部」去推荐页。地图中心随 `moveend` 更新。

**涉及文件：** `lib/mapTheme.ts`、`components/Map/StyleSwitcher.tsx`、`components/Map/PopularCard.tsx`、`components/Map/MapExplorer.tsx`

---

### #2 收藏 / 点赞

依赖用户系统，新增活动的点赞与收藏：

- **数据库**：新增 `Reaction` 表（一张表 + `ReactionType` 枚举 LIKE/FAVORITE 区分），唯一约束 `(userId, eventId, type)` 防重复，删活动级联清理。db push 到 Neon。
- **服务层** `services/reactions.ts`：`getReactionState`（点赞/收藏计数 + 当前用户是否已操作）、`toggleReaction`（切换，返回新状态 + 计数）、`listFavoriteEvents`（我的收藏，附作者）。service 不读 cookie，userId 由 route 传入。
- **API**：`GET/POST /api/events/[id]/reactions`（查状态 / 切换，POST 需登录）、`GET /api/favorites`（我的收藏）。
- **详情页**：头部日期行右侧新增 ❤️ 点赞 + 🔖 收藏按钮（带计数、激活态变色），乐观更新 + 失败回滚，未登录提示登录。
- **个人页**：新增「收藏」tab，**卡片瀑布流**（`columns-2` 2 列，与推荐页一致：封面图 + 色条 + 分类日期 + 标题 + 场馆 + 简介 + 「已收藏」角标），足迹地图同步打点，点击进详情（可在详情里取消收藏，关闭时刷新列表）。
- **图标**：`icons.tsx` 新增 `IconHeart` / `IconBookmark`（支持 `filled`）。

> 注意：本地改 schema 后 dev server 需**重启**才能加载新生成的 Prisma client（否则 `prisma.reaction` 为 undefined → 500）。

**涉及文件：** `prisma/schema.prisma`、`services/reactions.ts`、`app/api/events/[id]/reactions/route.ts`、`app/api/favorites/route.ts`、`components/Recommend/EventDetail.tsx`、`components/Me/MeView.tsx`、`components/icons.tsx`

---

### 推荐详情全屏化 + 发帖人/评论作者展示

`Recommend/EventDetail`（地图弹窗、推荐、日历三处共用）改造：

- **全屏**：从底部抽屉式改为 `fixed inset-0` 全屏铺满（同发帖 form）。
- **固定头部**：下滑时分类 / 标题 / 日期始终可见；地点、图片、简介、评论在下方滚动区。
- **右上角 ×**：补回关闭按钮（此前底部行换成问导游/看地图/来源后丢失）。
- **发帖人**：用户发布的活动顶部显示作者头像 + 用户名（`EventDTO.author`）。
- **评论作者**：每条评论显示作者头像 + 用户名 + 时间；头像无图时首字母圆形兜底；旧 `me` 评论显示「用户」。
- **未登录评论**：发送返回 401 时提示「请先到个人页登录」。
- 推荐页 / 日历页 DTO map 补 `author`，作者信息随活动传到详情。

**涉及文件：** `components/Recommend/EventDetail.tsx`、`app/recommend/page.tsx`、`app/calendar/page.tsx`

---

### 日历样式时间筛选（地图 + 推荐）+ 发帖/打卡时间选择改进

把地图原有的「今天/本周/本月」预设按钮升级为**可视化日历范围选择**，并给推荐页补上时间筛选：

- **共享日期逻辑** `lib/dateFilter.ts`：`DayRange`（YYYY-MM-DD，全 null = 全部时间），按**东京日历日**做活动 [start,end] 与所选区间的重叠判断；快捷预设（今天/本周末/本月）；范围含过去日期时自动忽略「过期」过滤（用户主动看历史）。
- **日历范围选择器** `components/common/CalendarRangePicker.tsx`：月历点选 from→to（自动排序）、月份切换、周末标红、今天蓝点、快捷预设、清除。
- **地图筛选**（`Map/Filters.tsx` + `MapExplorer.tsx`）：`FilterState.dateRange` 由枚举改为 `DayRange`；时间区折叠展开内嵌日历；过滤逻辑用 `eventInDayRange`。
- **推荐筛选**（`Recommend/RecommendList.tsx`）：分类 chip 行右侧新增时间 chip + 下拉日历（点外部收起）。
- **发帖/打卡时间选择**（`PostDialog` / `CheckInDialog`）：原生 `datetime-local` 换成风格统一的 `components/common/DateTimeField.tsx`（弹出月历单选 + 时/分下拉），输出仍是 `YYYY-MM-DDTHH:mm`，兼容既有 `toISO()`。

**涉及文件：** `lib/dateFilter.ts`、`components/common/CalendarRangePicker.tsx`、`components/common/DateTimeField.tsx`、`components/Map/Filters.tsx`、`components/Map/MapExplorer.tsx`、`components/Map/PostDialog.tsx`、`components/Map/CheckInDialog.tsx`、`components/Recommend/RecommendList.tsx`

---

### 评论 / 发帖作者信息（后端打底）

为「评论和发帖显示人物信息」铺底（前端展示随后接）：

- **评论**：`services/comments.ts` 列表 join `User` 附作者公开信息（用户名/头像）；发表评论改为**需登录**（route 取 `getCurrentUserId()` 传入，旧 `me` 数据作者为 null）。
- **活动**：`services/events.ts` 的 `getEventsInBounds` / `listUserEvents` 批量附作者（仅 USER 帖有 `userId`）。
- **类型**：`lib/types.ts` 新增 `UserBrief`，`EventDTO` / `CommentDTO` 加可选 `author`。

**涉及文件：** `services/comments.ts`、`app/api/events/[id]/comments/route.ts`、`services/events.ts`、`lib/types.ts`

---

### 修复：重新抓取产生重复活动

- **现象**：重新 `extract` 后同一活动出现多条。
- **根因**：去重键含 `startTime`，而日期来自无时区字符串 `"2026-03-27T00:00:00"`，被不同环境/时区解析成不同 UTC（差几小时甚至跨天），导致同一活动判不出重复。诊断：206 条里 92 个标题重复，sourceUrl 相同、仅 startTime 漂移。
- **修复**：① 去重键改为 `(title, sourceUrl)`，sourceUrl（每条活动的详情页/官网）已唯一、不依赖易漂移的时间；② JSON-LD 日期补东京时区 `+09:00`，存储也稳定。
- **清理现有重复**：跑一次 `npm run extract -- --reset`（清掉抓取活动重抓，去重即正确）。

**涉及文件：** `services/extraction/ingest.ts`、`services/extraction/sources/jsonLd.ts`

---

### 测试账号一键登录（当前阶段方便用）

- 预置 5 个真实感测试账号（さくら / ケンジ / 小林ゆい / たけし / 美咲，各带签名 / 常住地 / 状态）。
- 登录页底部「测试账号 · 一键登录」区：点选即登录、**无需注册**；首次点选自动创建该账号（含预置资料）。
- 统一口令只在服务端（`services/users.ts`），不暴露前端；`/api/auth/demo` 仅接受白名单用户名。

**涉及文件：** `lib/demoUsers.ts`、`services/users.ts`（`ensureDemoUser`）、`app/api/auth/demo/route.ts`、`components/Auth/AuthForm.tsx`

---

### #1 用户系统（本地账号）

从"单用户 `me`"升级为真实账号：

- **数据库**：新增 `User` 表（用户名 / 口令哈希 / 个性签名 / 头像 / 常住地 / 状态）；`Event` 加 `userId`（发帖作者）。db push 到 Neon。
- **认证**：`bcryptjs` 口令哈希 + `jose` 签发 JWT 存 httpOnly cookie。`lib/auth.ts`（hash/verify/session/getCurrentUser）+ `/api/auth/{register,login,logout,me,profile}`。
- **个人页**：未登录显示登录/注册表单（`AuthForm`）；登录后显示资料卡（头像 / 用户名 / 状态 / 签名 / 常住地，可内联编辑 + 头像上传 + 登出）+ 原有打卡/发帖足迹。全局登录态 `AuthContext`（layout 挂载）。
- **权限**：未登录**不可打卡 / 发帖**（前端 toast 提示 + 后端 401）；打卡 / 发帖记录真实 `userId`；打卡列表、我的发帖按当前用户过滤；删除仅本人可操作。
- **依赖**：`bcryptjs`、`jose`；env 加 `AUTH_SECRET`（本地有开发默认）。

> 待办：评论作者用户名展示；**#2 收藏 / 点赞**（依赖本系统）。旧 `userId="me"` 的历史数据保留、不迁移。

**涉及文件：** `prisma/schema.prisma`、`lib/auth.ts`、`services/users.ts`、`app/api/auth/*`、`components/Auth/{AuthContext,AuthForm}.tsx`、`components/Me/{MeView,ProfileHeader}.tsx`、`services/{checkins,events}.ts` 与对应 route、`components/Map/MapExplorer.tsx`、`app/layout.tsx`、`.env.example`

---

### loading 趣味化 + AI 导游活动入口

1. **loading 趣味化**：切 tab 的加载占位从单调转圈，改为**分类色波浪跳动圆点 + 文案**（推荐"正在为你找活动…"、日历"正在翻日历…"、个人"正在整理足迹…"），抽出 `PageLoading` 组件。
2. **AI 导游活动入口**：把 `GuideChat` 提升为**全局**（`GuideContext` + layout 挂载），活动详情抽屉、地图弹窗卡片新增「问导游」按钮 → **针对该活动**开对话（快捷问题嵌入活动名，并把活动信息作为上下文注入首条消息，AI 聚焦讲解）。地图页保留浮动入口（通用咨询，`GuideFab`）。

**涉及文件：** `components/PageLoading.tsx`、`app/{recommend,calendar,me}/loading.tsx`、`components/Guide/{GuideContext,GuideChat,GuideFab}.tsx`、`app/layout.tsx`、`components/Map/MapExplorer.tsx`、`components/Recommend/EventDetail.tsx`、`app/globals.css`

---

### 发帖/打卡表单现代化改版

把朴素的"label + 灰边输入框"重做为简约高级、与全站一致的风格：
- 抽出共享样式 `formStyles.ts`：浅灰底 + 细边 + 大圆角输入，聚焦变白底 + 蓝色描边/柔光环。
- 分类改为圆角标签（选中填分类色 + 阴影）；图片上传改为大虚线框 + 居中「＋ 选择图片」，预览图圆角全宽。
- 坐标做成 pill；label 弱化为小灰字；必填项标红 *；底部主按钮全宽实心、取消次要。
- `BottomSheet` 头部加分隔线、抓手与标题层次微调。发帖与打卡共用同一套视觉。

**涉及文件：** `components/Map/{formStyles,PostDialog,CheckInDialog,BottomSheet}.tsx`

---

### AI 导游咨询

- 新增 **AI 导游**：地图页右侧紫色浮动入口 → 全屏聊天面板。
- 资深导游 system prompt：讲解活动信息、历史文化渊源、看点，给出推荐与**路线/交通建议**；纯文本输出（约束不用 Markdown）；不确定信息提醒以官方为准、不编造。复用 DeepSeek（`/api/chat`，保留最近 12 轮上下文）。
- 提供 4 个**默认快捷问题**（今天去哪 / 周末展览市集 / 一日游路线 / 祭典历史渊源），点一下即开始。
- 实测：DeepSeek 回复专业（神田祭"江户总镇守"渊源、深川八幡祭泼水文化、门前仲町站交通等）。

**涉及文件：** `lib/llm.ts`（`chatWithGuide`）、`app/api/chat/route.ts`、`components/Guide/GuideChat.tsx`、`components/icons.tsx`（`IconSparkles`）、`components/Map/MapExplorer.tsx`

> 待办（用户系统 v2，已确认需求）：简单本地账号（口令 bcrypt 哈希）；用户资料字段=用户名 / 个性签名 / 头像 / 常住地（可选）/ 状态；用于发帖、评论区分用户，并支撑收藏与点赞。未登录不可打卡/发帖，个人页提供登录入口。

---

### 表单全屏化 + 打卡图片/时间 + tab 切换反馈

1. **发帖/打卡表单全屏可滑动**：`BottomSheet` full 状态改为全屏（`h-[100dvh]`，顶贴屏幕顶、底贴屏幕底）、`z-[999]`、隐藏滚动条；peek/full 拖动切换，关闭走右上角 ×。
2. **打卡支持图片上传 + 打卡时间**：`CheckInDialog` 把"照片外链"换成 Cloudinary 图片上传（与发帖一致：客户端压缩后上传，DB 只存 URL）；保留 datetime「打卡时间」（写入 `CheckIn.createdAt`）。
3. **tab 切换反馈**：给 recommend/calendar/me 加 `loading.tsx`（点 tab 立即显示加载 spinner，消除"卡住"感）；`BottomNav` 乐观高亮（点击立即高亮目标 tab + 轻微放大），配合 `template.tsx` 入场动画。
4. 移除之前 peek 的"取消 FAB"（被全屏 sheet 盖住、已失效），关闭统一走拖动收起 + ×；peek 上拉限制不越过屏幕顶。
5. **推荐卡片限高**：标题 `line-clamp-2`，长标题截断为两行，避免撑乱瀑布流。
6. **地址定位增强（可选 LLM）**：含建筑名/设施名的地址 GSI 常定位到区中心（如「東京タワー」落到都厅）。新增 `GEOCODE_LLM_FALLBACK` 开关，开启后用 LLM 把这类地址规范成标准住所再地理编码（「東京タワー」→「東京都港区芝公園」、「TOKYO DREAM PARK」→「東京都江東区有明3-3-8」），东京边界校验兜底 LLM 幻觉。

**涉及文件：** `components/Map/{BottomSheet,CheckInDialog,PostDialog,ActionFab,MapExplorer}.tsx`、`components/BottomNav.tsx`、`components/Recommend/RecommendList.tsx`、`app/{recommend,calendar,me}/loading.tsx`、`lib/llm.ts`、`services/extraction/ingest.ts`、`.env.example`

---

### 日历长期活动展期显示 + 推荐页分类筛选

1. **日历长期活动**：跨多天的活动（`startTime`→`endTime`）在**展期每一天都显示条目**（之前只在开始日）；当天清单里这类活动的时间列标「展期中」。`byDate` 分组改为按 UTC 午夜从开始日逐天迭代到结束日填充（`guard < 366` 防异常 `endTime` 导致超长循环）。
2. **推荐页分类筛选**：瀑布流上方加分类 chip（全部 + 6 类），点击按 `category` 过滤；再点同一类或「全部」取消。

**涉及文件：** `components/Calendar/CalendarView.tsx`、`components/Recommend/RecommendList.tsx`

---

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
