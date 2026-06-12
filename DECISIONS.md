# 关键决策记录

> 记录已确认的、不会轻易变动的设计/技术决策，供换设备或新对话时快速重建上下文。

---

## 架构

- **薄 route handler + 厚 service 层**：领域逻辑全在 `src/services/*`，route handler 只解析参数/调 service/返回响应。目的：为未来迁移 Python 留门。
- **数据库即接缝**：未来 Python 服务接入时，以 DB + HTTP/JSON 为边界，不提前搭抽象层。
- **v1 单用户**：`userId` 固定 `"me"`，所有打卡/发帖都属于本人。v2 接入真实认证后替换。

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

## 导航与页面

- 底部 4 tab：地图 / 日历 / 推荐 / 个人（`grid-cols-4`）
- **日历页**按"东京时区当天"对活动分组；详情统一复用 `Recommend/EventDetail`（地图弹窗、推荐、日历三处入口共用同一详情抽屉）

## 天气

- 入口在地图页（`WeatherPanel`）：按钮显示当前温度，点开 → 底部横向滑 7 天卡片 + 地图上层天气动画
- 动画（`WeatherAnimation`）按当前天气大类切换，CSS keyframes 实现，`pointer-events:none`，纯装饰
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

## 阶段约束

- **只实现 v1**，v2/v3 功能（认证、审核、个性化推荐、社交整合、Python 服务）不超前实现，代码用 `TODO` 标注挂载点
- 下一阶段（v1.5）：锚点发帖完善、地图风格切换器
