# CHANGELOG

## 2026-09-04

### 评论加载体验
- 个人页与发现页足迹评论区区分加载、失败重试和确认无评论；已有明确零计数时跳过首次请求，再次展开保留已加载评论。
- 帖子详情评论请求失败不再显示无评论，回复分页新增失败重试反馈；加载状态使用无障碍提示。

### 底部菜单选中态优化
- 增加选中角色轻微上浮、柔和投影、底色顶部高光与按压回弹；动效遵循减少动态效果偏好，不添加循环动画。
- 移除角色外围独立方框与描边，改为同时包裹角色和文字的柔和渐变圆角底色；统一文字高亮并补充键盘焦点提示，保留底栏原高度。

### 社区模拟图片持久化修复
- Action 注入现有 Cloudinary 三个 Secrets，模拟图片优先使用服务端签名上传，兼容 Vercel 原 unsigned preset 配置。
- 生图前检查上传配置；上传失败不再退回临时网址，新增上传和数据库保存结果日志，不输出密钥或图片内容。

### 菜单专属功能 IP 与足迹评论统一
- 标准版与女性版菜单重新设计为角色配合大地图、日历、放大镜、个人卡片的功能形象；女性版强化玫粉实体色、紫色阴影和轮廓，移除未选中状态的灰度及透明度。
- 使用新版本透明 PNG 资产和按角色区域保比例显示，保留旧原稿；底栏角色放大至 52px，避免条带被拉伸或相邻图案串入。
- 个人页改为按名字选择“云足·晴空、云足·樱梦、路灵·远行、路灵·花语”；底部四个入口统一为所选同一角色配不同道具，不再混搭。新选择保存在本机，兼容旧标准/女性偏好，无需数据库迁移。
- 个人页与发现页共用足迹评论展示组件，统一头像、时间和分层回复。发现页加载回复并通过 parentId 发送，不再把评论截断为三条；补充取消回复、重复发送保护、失败提示和输入法回车保护。

## 2026-09-03

### 统一“云迹东京”产品品牌
- 应用名称统一为“云迹东京（CloudFootprints Tokyo）”，浏览器标题更新为“云迹东京｜发现活动，记录足迹”，并同步发现页、日历页和 AI 导游称呼。
- 新增云朵与足印组合的品牌图标和 Web App Manifest，替代界面中的默认项目图标，并支持浏览器收藏及安装场景。

### 接入云足 Kumoashi 与路灵 Michiru
- 地图底部导航选中态使用路灵，探索选中态使用云足；地图发布入口改为两个角色共用的足印符号，使角色分别承接“引导行动”“发现生活”和“留下记录”的产品语义。
- 进入目的地 500 米内的到达提示使用路灵，足迹保存成功卡使用云足，形成从路线引导到生活记忆的连续反馈。
- 新增适合小尺寸界面的矢量角色组件，女性形象采用更深梅紫轮廓、玫红重点色及清晰粉紫层次，提升浅色界面的识别度。
- 个人资料编辑新增“标准形象/女性形象”选择并保存在当前设备；暂不增加数据库迁移，未来接入账户性别字段时只需统一扩展角色偏好解析入口。
- 项目内归档云足和路灵的标准版、女性版完整角色设定原稿，并补充角色职责、文件导航及使用约定，方便后续界面与品牌物料继续复用。
- 底部地图、日历、探索和个人四个入口全部替换为完整 3D IP 角色姿态，不再混用传统线性图标或简化角色矢量图；标准版与女性版分别使用透明导航条带并跟随用户偏好切换。

### 建立“想去 → 提醒 → 路线 → 到访 → 足迹”闭环
- “想去”列表按照活动时间显示待定、未来、本周、24 小时内、进行中和已结束等站内提醒状态，进行中和临近活动优先显示，并识别已经关联足迹的活动。
- 想去活动提供直达路线；活动开始后可直接“记录到访”，地图自动定位并打开已关联该活动的足迹表单，完成后在个人页显示为“已留足迹”。
- 活动详情的地图动作改为直接打开路线，并在活动开始后提供“记录到访”入口；整个闭环复用现有想去和足迹数据，无需新增数据库迁移。
- 从活动详情或“想去”深链进入路线/到访流程时不再弹出“附近活动”；路线、足迹或线路抽屉打开期间也会隐藏附近推荐，避免多个抽屉重叠。
- 用户主动为活动打开路线后，应用仅在浏览器本地检测与目的地的距离；进入 500 米范围会询问是否记录到访，不会自动签到或上传持续位置。
- 活动结束后“想去”状态会询问“你去了吗”，并提供“去过，留足迹”；成功提交后展示完成卡，可返回地图或查看个人足迹。
- 足迹表单新增可选活动关联：默认保留入口活动，列出 200 米内的多个活动，支持按名称搜索其他已有活动，也可选择“不关联活动，仅记录地点”；系统不再仅凭同一坐标静默决定关联对象。

### 修正详情标题栏与发现页足迹图片
- 用户内容详情顶部移除“生活动态/用户活动”文字徽标，保留两类详情各自已有的版式区分，避免移动端操作区被挤压。
- 发现页足迹单图改为按原始宽高比动态展示并限制最大高度；多图统一使用正方形缩略图，避免不同来源尺寸造成网格错位。
- 个人页编辑足迹不再显示或修改打卡时间，编辑内容时保留足迹原始创建时间。
- 个人页足迹的点赞和评论按钮补齐真实交互；评论区显示作者与时间，支持回复评论，并可从互动消息直接定位到对应足迹。
- “互动”消息新增别人对本人足迹的评论、评论回复和点赞，继续沿用现有 Comment/Reaction 关联，无需数据库迁移。

### 优化 GPT Image 2 图片生成
- GPT Image 2 使用独立的自然生活摄影提示词，不再复用 Agnes 的长负面规则；质检仅拦截明显 AI 痕迹、严重人体错误、场景冲突和显著文字水印。
- OpenAI 图片固定使用 `medium` 质量和标准竖版 `1024x1536`，Agnes 继续沿用原提示词和严格质检。
- 个人页的足迹和虚拟发帖“重新生图”继续按照部署环境的 `IMAGE_PROVIDER` 选择模型，并共享相应模型的提示词与质检配置。
- 用户帖子详情图取消固定高度与 `object-cover` 裁切，按原始宽高比动态计算高度并完整显示图片。
- 个人页足迹单图按原始比例动态显示，最大高度限制为视口的 70%（桌面端不超过 640px）；多图使用统一方形缩略图和居中裁切，点击后仍可查看完整原图。
- GPT Image 2 身份参考提示仅继承稳定脸部身份与身体比例，不锁定发型，并禁止照搬参考图的表情、视线、头部角度、姿势、构图和光线，要求按新场景生成自然的新视角与发型。
- 世界状态新增按月及旬动态推导的东京全年气候与物候语境，覆盖冬季裸枝、梅花、樱花、新绿、梅雨、盛夏、残暑、初秋、红叶和初冬；内容决策与两套生图提示词共同使用，避免四季标签造成提前变色、错季花木或无故积雪。
- 新增按东京日期预览或替换模拟发帖/足迹图片的脚本，并在社区推演手动工作流提供日期入口。

### 修复虚拟用户帖子未显示在地图
- 用户及虚拟用户帖子查询补齐当前地图视野 bbox，避免全局 500 条截断令视野内帖子无法进入地图数据。

### 拆分普通动态与用户活动
- `Post` 新增 `PostKind.LIFE/ACTIVITY`：生活动态使用 `createdAt` 作为发布时间且不设置活动时间或报名，用户活动使用 `startTime/endTime`，未填结束时间时以开始时间作为截止时间。
- 数据迁移将现有带 `social` 标签的模拟内容归为 `LIFE` 并清理旧的活动时间，其余现有用户内容保持为 `ACTIVITY`。
- 地图发布菜单拆成“动态 · 分享此刻”“活动 · 邀请参加”“足迹 · 我来过”；生活动态使用相机标记，用户活动使用日历标记，并可在“更多”中分别显示或隐藏。
- 日期筛选对生活动态使用发布时间、对活动使用活动区间；日历页只收录官方活动和用户活动，生活动态不进入活动日历。
- 详情、个人页列表和编辑表单按内容类型显示发布时间或活动时间，普通动态不再出现活动报名与活动时间控件。

## 2026-09-02

### 增加 OpenAI GPT Image 2 生图选项
- 社区人物配图新增 `IMAGE_PROVIDER=openai`，默认使用 `gpt-image-2`；文生图调用 generations，身份参考图调用高保真 edits，并沿用现有质检、重试和 Cloudinary 持久化流程。
- 新增 OpenAI 图片 API 地址、模型、尺寸与质量环境配置，并接入社区推演 GitHub Actions secrets。
- 社区推演手动 Action 新增生图模型下拉选择；选择 OpenAI 时如遇额度不足或限流（HTTP 429），自动降级到原有 `agnes-image-2.1-flash`。

### 增加“今天适合你的 3 个地方”
- 活动发现页新增每日三选推荐，以活动主题和体验为核心展示推荐理由、注意事项、来源状态与虚拟人物补充视角。
- 推荐理由优先使用每个活动在抓取阶段生成的独有摘要或活动描述，仅在内容缺失时退回类别体验文案，减少同类活动理由重复。
- 登录用户标记“想去”后会写入独立的想去数据并用于后续推荐；“不感兴趣”仍保存在当前设备。
- 未登录用户点击“想去”会进入个人页登录界面；保存失败使用推荐模块内的状态提示，不调用系统弹窗。
- “想去”采用即时选中反馈并在后台保存，不展示技术性加载文案；“不感兴趣”会先将卡片平移淡出，再补入下一条推荐。
- 个人页使用“活动”收纳入口，分别展示“想去 / 收藏 / 报名”，保留三种不同语义；网格布局让两条活动在手机端并排占据两列。
- “不感兴趣”卡片使用 380ms 左滑离场动画，离开视口后再由下一条推荐补位。

### 重新开启图生图锁脸
- Agnes 图生图接口恢复验证通过后，社区推演工作流重新传入人物身份参考图，以改善连续生图的人脸一致性。

## 2026-09-01

### 统一人物模型与内容多样性
- WritingDNA 成为唯一运行口吻标准，`socialProfile.friendInfluence` 成为唯一朋友影响标准，`initialContext` 只负责初次状态；人物按 C01-C13 稳定排序，并修正 C07/C09/C10 身份。
- C09 继续以数据库现有用户名“小林ゆい”为唯一标准，职业与定位统一为古着生活博主，不执行账号迁移。
- 移动半径、探索概率、周末模式、消费偏好、回避兴趣及朋友/熟人圈已接入每日决策与社区发帖；新增非兴趣型生活触发器并细分各人物兴趣，降低内容同质化。

### 修复虚拟内容地点错位与集中
- Persona 日文地区不再通过文字哈希伪造东京范围坐标；所有当前使用的居住区、常去区域和探索目的地都映射到真实地区中心，未知地区会被跳过。
- 足迹和普通发帖正文明确提到已知地区时，存储坐标优先跟随正文；内容语义可覆盖不一致的 LLM 地点索引。
- 无效足迹索引不再固定落到第一个候选；发帖/足迹同分候选会分散选择，减少长期集中在少数地点。
- 本次只影响后续新生成内容，现有历史记录不自动移动。

### 修复抓取活动时间统一为零点
- Walkerplus 与 Jalan 的 JSON-LD 只有日期时，不再直接把可用的详情页举办时间丢失；共享解析器会从“開催時間”区段提取主时段并合成东京时区时间。
- 多场次活动使用第一场开始和最后一场结束，页面 `※` 后的例外时段不覆盖主时段；JSON-LD 已提供精确时间时保持原值。
- 新活动会直接写入精确时间，重新抓取已存在的零点活动时会沿用既有更新逻辑回填精确时间。

### 增加代码导航与函数文档规则
- 新增 `docs/CODEMAP.md`，按功能和目录记录代码入口、文件职责及无需继续扩查的边界，帮助 Agent 减少无目的仓库探索。
- `AGENTS.md` 要求修改前先查询 Code Map，并在文件职责变化时同步维护。
- 新增命名函数、方法、组件、Hook、Route Handler 或脚本入口时，必须用 TSDoc 写明完整签名和职责；重要修改既有函数时也需补齐或更新。

### 地图用户内容显隐
- 地图页底部“更多”菜单新增用户足迹和用户发帖开关，可分别隐藏两类用户内容。
- 显隐选择会保存在浏览器本地；隐藏内容会在进入地图聚合前过滤，不再计入聚合数量。

### 修复活动标签点击误放锚点
- 地图空白点击判定现在覆盖活动文字标签、单点柔光和聚合圆的完整视觉区域，并增加少量边缘容错。
- 点击活动文字标签会直接打开活动，不再被误判为空白区域并放置探索锚点。

> 压缩版修改履历。这里记录当前仍有参考价值的产品能力、架构变化和重要取舍；已被后续方案完全替代的细碎 UI/实现日志合并到阶段摘要中。
>
> 规则：新增变更优先写“用户可见结果 / 数据或架构影响 / 关键文件”，避免记录每一次微调。稳定决策放 `DECISIONS.md`，排障细节只在必要时保留。

---

## 2026-07-29

### Prevent image-memory contamination during LLM outages
- Image generation now stops before calling the image provider when the scene-prompt LLM is unavailable, instead of sending a coarse fallback `imageSpec` that can produce low-quality images.
- Added a guarded cleanup utility that previews affected image-less PersonaV2 posts/check-ins, writes a recovery backup, and clears only their stored `imageSpec`; character life memories and content remain untouched.
- Cleaned 20 image-less records from the July 25-29 outage window (9 check-ins and 11 posts). A recovery backup was written before the database transaction, and a follow-up dry run found no remaining candidates.

### Allow deleting images while editing a post
- The post editor now shows every stored image with an individual delete control, including posts that are not eligible for AI image regeneration.
- Saving an empty image list explicitly clears both the post gallery and its cover image, and discovery/profile caches are revalidated after the update.

### Remove repeated summer neck scarves and bow ties
- Persona wardrobe prompts no longer use ambiguous generic ribbon details or optional silk scarves that image models could reinterpret as the same neck accessory across characters.
- Summer image prompts now require a clean, breathable neckline and explicitly exclude scarves, neckerchiefs, bow ties, ascots, ribbon ties, sailor ties, and decorative collar bows. Hair ribbons remain available only for matching personas and must be visibly placed in the hair.
- Image QA now rejects generated summer portraits that violate the neckline rule, allowing the retry prompt to correct the outfit before publishing.

---

## 2026-07-17

### Cache daily official content without delaying live community data
- Official events are cached for 24 hours at the service layer and reused by map, calendar, and discovery queries. User posts remain uncached and are merged into every response in real time.
- Calendar and discovery routes stay dynamic for fresh community content, while discovery loads 24 public footprints initially and continues with the existing infinite loader in batches of 40.
- Bottom navigation warms routes on pointer hover or touch, reducing click-to-render latency without preloading the heavy map bundle during initial page load.

### Show newly published footprints immediately
- The discovery page now reads current public content on every visit instead of serving a five-minute ISR snapshot, and check-in create/edit/delete operations invalidate the discovery route.
- Personal-page footprint galleries now size themselves by image count with up to three images per row: one full-width image, two half-width images, or three equal thumbnails.

### Open direct messages in place
- The private-message action on a user post now opens the target conversation as an overlay on top of the current post instead of navigating through the personal messages page first. Closing the chat returns to the same post context.

### Diversify Mizuki's travel wardrobe
- Mizuki's image-generation profile now uses a varied resort-casual wardrobe rather than a narrow outdoor-utility capsule. Linen sets, airy dresses, seaside layers, relaxed separates, seasonal getaway layers, and broader color rotations are available.
- Cameras, backpacks, and hats are now optional scene-driven accessories instead of fixed identity markers, reducing repeated outfits caused by the face reference and the previous cargo-heavy trend filter.

---

## 2026-07-15

### Add direct messaging and persona replies
- Users can start one-to-one conversations from user posts and follow lists, then use the new private-message view under My > Messages; conversations support unread counts, optimistic sending, read state, recent-message polling, and a full-screen mobile chat layout while preserving the existing interaction notices.
- Direct conversations and messages are persisted in dedicated indexed tables with participant authorization. When the recipient is a PersonaV2 demo user, replies are generated from that character's personality, voice, current emotion, goals, recent memories, and conversation history, with a persona-aware fallback when the LLM is unavailable.
- Applied migration `20260715110000_add_direct_messages` to the current database.
**Main files:** `prisma/schema.prisma`, `prisma/migrations/20260715110000_add_direct_messages/migration.sql`, `src/services/directMessages.ts`, `src/app/api/messages/route.ts`, `src/app/api/messages/[conversationId]/route.ts`, `src/components/Me/DirectMessages.tsx`, `src/components/Me/MeView.tsx`, `src/components/Me/ProfileHeader.tsx`, `src/components/Recommend/EventDetail.tsx`, `src/lib/llm.ts`

---

## 2026-07-10

### Ensure demo footprints stay public
- Demo seed check-ins now write `isPublic: true`, matching the scheduled simulation path so reset/reseeded virtual-user footprints still appear in discovery and map aggregations.
- Re-ran `scripts/publish-demo-checkins.ts`; current PersonaV2 scope has 13 demo users, 0 private check-ins, and 903 public check-ins.
- Discovery check-ins now use paged lazy loading instead of a fixed first 40 records, and the current database has been backfilled so all 1081 check-ins are public.
- Official activity search now treats the full activity list as the primary result area: typing a search term scrolls to all activities and hides the banner/hot/recommended blocks while searching.
- Discovery and official activity sections now use subtle background bands to make recommendation, full-list, footprint, and mood modules easier to distinguish while keeping cards lightweight.
- Large discovery cards and section containers now use more restrained 12px-style corners and finer borders/shadows, reducing the overly rounded look while keeping small pills and avatars circular.
- Section backgrounds now use a cleaner modern white panel treatment with top accent rules and restrained shadowing instead of plain tinted blocks or grid/gradient decoration, and activity cards were tightened further to smaller rounded corners.
- Module headers now use a small geometric icon marker, and the long thin divider above titles was removed while preserving the short accent rule on each section.
- Module header icons now vary by section with distinct semantic shapes and colors, closer to the visual language of editorial event blocks.
- Section headings now have safer vertical spacing and fixed-aspect icons, while activity, post, and footprint cards use content-height masonry layouts so image-free cards no longer leave uneven blank rows.
- Activity sharing now falls back to a compatibility-safe link copy flow when native sharing is unavailable, with visible success or failure feedback instead of silently doing nothing.
- Map opening is faster: map activity requests now use a lightweight `map=1` payload, map check-ins avoid discovery-only counts, and event/food layer fetches no longer block each other in sequence.
**Main files:** `scripts/seed-demo.ts`, `scripts/publish-demo-checkins.ts`, `src/services/simulation/engine.ts`, `src/services/checkins.ts`, `src/services/events.ts`, `src/app/api/checkins/route.ts`, `src/app/api/events/route.ts`, `src/app/recommend/page.tsx`, `src/components/Recommend/RecommendList.tsx`, `src/components/Map/MapExplorer.tsx`

---

## 2026-07-04

### 个人页足迹显示互动数
- 个人页面的足迹时间线新增点赞数和评论数展示，与发现页的足迹互动数据保持一致。
**主要文件：** `src/components/Me/MeView.tsx`

---

### 修复发现页筛选标签
- 探索页“发现”里的关注、附近、最新、热门筛选现在同时作用于用户发帖和公开足迹。
- 关注会拉取当前用户的 following 列表并过滤作者；附近会尝试浏览器定位并按距离排序，定位失败时使用东京中心兜底；热门会使用发帖热度和足迹点赞/评论数排序。
- 推荐页公开足迹查询补充 `_count`，让足迹热门排序能拿到点赞和评论计数。
**主要文件：** `src/components/Recommend/RecommendList.tsx`, `src/app/recommend/page.tsx`

---

### 模拟发帖适当生成配图
- 普通社区模拟发帖不再总是无图；会按角色拍照倾向、正文长度、类别和地点语义，给一部分适合配图的帖子生成生活照。
- 发帖配图复用现有人物级生图管线与 camera profile，写入 `Post.imageSpec`，生成成功后回填 `imageUrl/imageUrls`。
- 图片生成失败不会阻断发帖落库，保留 `imageSpec` 以便后续用现有重新生图接口补图。
**主要文件：** `src/services/simulation/social.ts`

---

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
