# 东京活动地图 —— 项目设计书

> 本文档是给 **Claude Code** 的实现规格(spec)。请严格按"分阶段路线图"实施,**只实现 v1 范围内的内容**,为后续阶段留出挂载点但不要超前实现。

---

## 1. 项目概述

**一句话定位:** 一个让我在东京想出门时,能在地图上直观看到附近正在举行的活动(展览 / 市集 / live / 祭典)的应用。

**动机:** 我住在东京,常常想出门转转却不知道哪里有值得去的活动。市面上的信息散落在各处、且大多是非结构化的日文网页,没有一个"在地图上一眼看全"的入口。

**核心理念:**
- **先为自己一个人做好用**(build for yourself first)。v1 不追求功能齐全,只追求"我自己能天天用起来"。
- **先验证可行性,再扩展**。架构上为未来留门,但当下保持最小、最快。

**附带的个人目标:** 借这个项目提升 AI 应用能力——重点练 **LLM 结构化信息提取** 与对其 **质量的评测(eval)**,后期再练 **个性化推荐 / 向量检索**。

---

## 2. 分阶段路线图(关键约束:不要一次做完)

| 阶段 | 目标 | 包含 | 解锁条件 |
|------|------|------|----------|
| **v1(验证 / 自用版)** | 自己能用起来 | 地图(官方数据撒点)+ 个人(自己的打卡足迹) | —— 当前要实现的全部范围 |
| **v1.5** | 完善单人体验 | 锚点发帖完善、地图风格切换器 | v1 自己用顺手后 |
| **v2** | 开放给他人 | 用户认证、AI 内容审核、推荐瀑布流、个性化排序 | 确认有持续使用价值后 |
| **v3(远期)** | 架构演进 + 社交整合 | Next 服务端退化为 BFF、重逻辑迁入 Python;谨慎、受限地整合社交平台信息 | 数据量与复杂度达到瓶颈后 |

> **给 Claude Code 的硬性要求:** 本次只实现 **v1**。v2/v3 的功能(认证、审核、推荐排序、社交整合、Python 服务)**不要实现**,但在代码结构上预留清晰的挂载点与 `TODO` 标记。

---

## 3. v1 范围界定(In / Out of Scope)

**包含(In scope):**
- 地图页:加载底图、按当前可视区域(矩形范围)拉取活动、以分类着色的 pin 展示、按日期与类别筛选、显示"我的位置"。
- 个人页:展示"我"的打卡足迹(地图 + 时间线)与历史。
- 打卡 / 发帖:地图上的浮动操作按钮(**不是第四个 tab**),在当前位置打卡(文字 / 照片 / 评分),或丢锚点发帖。
- 数据提取管线:把若干官方信息源的网页/接口抓下来,用 LLM 提取成结构化活动数据并入库(可手动触发或定时跑的脚本)。
- 提取质量评测(eval)的最小框架。

**不包含(Out of scope,留给后续阶段):**
- 用户注册 / 登录 / 多用户(v1 视为单用户,`userId` 字段可固定为本人)。
- 内容审核、举报、社区互动。
- 推荐 tab 的个性化排序算法(瀑布流页面可先用简单的时间/距离排序占位)。
- 社交平台(Instagram / 小红书)数据整合。
- PostGIS 的距离/半径查询、pgvector 向量检索(v1 用普通经纬度字段 + 矩形范围查询即可)。
- 托管数据库(v1 用本地 Postgres)。

---

## 4. 信息架构与导航

底部三个 tab:**地图 / 推荐 / 个人**。

- **地图**:主探索入口,空间维度("我附近有啥")。
- **推荐**:小红书式瀑布流(masonry),按"感觉"刷("今天我该去哪")。v1 仅搭出页面与卡片,排序用简单规则占位;个性化排序留到 v2。
- **个人**:我的打卡足迹、收藏、历史。

**"打卡 / 发帖"是动作,不是目的地** —— 实现为地图上的浮动操作按钮(FAB),不要做成第四个 tab。

两种内容动作要区分清楚:
- **打卡**:"我来过这里"(在当前位置,附照片/文字/评分,门槛低)。
- **锚点发帖**:"这里有个东西"(在地图上标记一个地点或活动并发布说明)。

---

## 5. 技术架构

### 5.1 验证期(v1)技术栈 —— 全 Next.js,单语言 TypeScript

| 层 | 选型 | 说明 |
|----|------|------|
| 前端 | React + Next.js(App Router)+ TypeScript | 开发者最擅长的栈 |
| 服务端 | Next.js route handlers | **保持薄**;它就是未来的 BFF |
| 业务逻辑 | 独立 `services/` 模块(纯 TS 函数) | **不要把逻辑写进 route handler**,为将来迁移留门 |
| ORM | Prisma | 开发者已熟悉 |
| 数据库 | 本地 PostgreSQL,Docker 跑(`postgis/postgis` 镜像) | v1 只用普通字段 + 矩形范围查询,**暂不启用 PostGIS / pgvector** |
| 地图 | MapLibre GL JS + CARTO Positron 底图 | 免费、扁平、好看;无需自定义样式 |
| 数据提取 | TS 脚本,调用 LLM API | 独立可运行的脚本,写入同一个 Postgres |

### 5.2 关键架构原则

1. **薄 route handler + 厚 service 层**:所有领域逻辑放在 `src/services/*` 的纯函数里;route handler 只做参数解析、调用 service、返回响应。这是未来把逻辑迁去 Python 的"迁移保险"。
2. **YAGNI**:现在**不要**搭 BFF↔Python 的抽象层或契约。只需保持模块干净。
3. **数据库即接缝**:未来 Python 服务接入时,以数据库(以及之后约定的 HTTP/JSON 契约)作为边界。

### 5.3 演进期(验证通过后,**本次不实现**,仅记录方向)

- **数据库迁移**:本地 Postgres → 托管(候选 Supabase,自带 PostGIS + pgvector + 认证 + 图片存储)。因为两端都是 Postgres,迁移主要是改连接串 + 跑迁移,**不需要重写查询**。
- **启用扩展**:PostGIS(距离/半径排序,用 Prisma `$queryRaw` 写原生 SQL)、pgvector(推荐与去重的向量检索)。
- **引入 Python(中间服务器模式)**:Next 服务端退化为 **BFF**(认证、给前端整理数据、调用下游);**重逻辑(数据提取、AI 推荐/向量)迁入 Python(FastAPI)** 下游服务。
- **选择性迁移**:**不要把后端逻辑全部搬走**。简单 CRUD、认证、给前端拼数据等,留在 Next/BFF 层。最终形态是"Next 管薄 Web/CRUD + Python 管 AI/数据重活"的**混合稳态**。
- **诚实预期**:Prisma 写的数据访问层若要搬到 Python,需用 SQLAlchemy 等重写一遍,这部分是实打实的工作量,不是免费重构 —— 故更要"选择性迁移"。
- **契约**:真要拆时,用 HTTP/JSON,TS 端 `zod`、Python 端 `pydantic`,保持类型对齐。

---

## 6. 数据模型

设计原则:**来源无关**。每条活动都带"来源 + 信任级别",这样将来无论接入更多官方源还是社交数据,都只是"多一个来源",去重/合并逻辑统一处理,不必返工。

### 6.1 Prisma schema 草案(v1)

```prisma
// schema.prisma —— v1 版本(普通经纬度字段,暂不引入 PostGIS / pgvector)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EventCategory {
  EXHIBITION // 展览
  MARKET     // 市集
  LIVE       // live
  FESTIVAL   // 祭典
}

enum SourceType {
  OFFICIAL_API
  OFFICIAL_WEB
  SOCIAL // 预留,v1 不使用
  USER   // 用户发布
}

model Event {
  id          String        @id @default(cuid())
  title       String
  description String?
  category    EventCategory
  venueName   String?
  address     String?
  lat         Float
  lng         Float
  startTime   DateTime?
  endTime     DateTime?

  sourceType  SourceType
  sourceUrl   String?
  trustLevel  Int           @default(0) // 官方高、用户/社交低
  rawText     String?       // 保留原始文本,便于以后重新解析

  checkIns    CheckIn[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // v1 用 lat/lng 做矩形范围查询即可,加索引
  @@index([lat, lng])
  @@index([startTime])
  @@index([category])
  // TODO(v2+): 增加 geom(PostGIS geometry)与 embedding(pgvector)字段
}

model CheckIn {
  id        String   @id @default(cuid())
  userId    String   @default("me") // v1 单用户,固定为本人;v2 接入真实用户
  eventId   String?  // 可选:关联到地图上已有的活动
  event     Event?   @relation(fields: [eventId], references: [id])
  lat       Float
  lng       Float
  note      String?
  photoUrl  String?
  rating    Int?     // 1–5
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}

// TODO(v2): model User { ... } 认证启用后引入
```

### 6.2 去重 / 合并(留给后续)

当来源不止一个时,用"场地 + 时间 + 标题相似度"判断两条是否为同一活动;低信任来源(用户/社交)用于补充、印证高信任来源(官方)。v1 不实现,仅在数据模型上预留 `trustLevel`。

---

## 7. 数据源(先官方,后社交)

**v1 先锁约 5 个信得过的官方源,跑通管线即可,不要贪多:**

- **东京都开放数据目录站**(`portal.data.metro.tokyo.lg.jp`):提供 API 形式数据(JSON,基本无 CORS 限制),含东京 Big Sight 等大型会展排期。优先用作起点。
- **GO TOKYO**(官方观光站):活动信息。
- **各区(区役所)官网**:本地市集、祭典。
- **美术馆 / 画廊官网**:展览。
- **live house / 票务站**:演出。
- (可选)connpass 等:技术类活动,有公开 API。

**采集原则:**
- 优先用官方 API;需要抓网页时,尊重 `robots.txt` 与各站条款。
- 多数源是非结构化日文网页 —— 这正是 LLM 提取要解决的问题。

**社交平台的现实约束(记录,避免早期依赖):**
- **Instagram**:官方 API 仅限已授权的商业/创作者账号,无公开发现/任意话题搜索;第三方爬取有封禁与法律风险。基本不适合用来捞"附近有啥活动"。
- **小红书**:有官方开放平台,但 2026 年转向白名单 + 审核接入,且偏商业/电商场景;非授权爬取风险高。
- 结论:社交整合放到 **v3**,且要谨慎、合规;v1/v2 不依赖。

---

## 8. 数据提取管线(本项目的 AI 核心)

### 8.1 流程

1. **采集**:按源拉取页面内容 / 调用官方 API。
2. **LLM 提取**:把内容喂给一个支持结构化输出的 LLM(如 Claude),要求输出严格的 JSON。
3. **地理编码**:把地址转成经纬度(候选:商用地理编码服务,注意额度/成本;具体选型见"开放问题")。
4. **校验 / 去重**:基础字段校验(必填、时间合法);去重留待多源时实现。
5. **入库**:写入 `Event` 表,带上 `sourceType`、`sourceUrl`、`trustLevel`、`rawText`。

### 8.2 提取 prompt 草案

> 要点:明确要求"只返回 JSON、不要任何前后缀/Markdown 围栏";给出字段定义与枚举;允许字段缺失时返回 `null`;一页可能含多个活动,返回数组。

```
你是一个活动信息抽取器。下面是一个来自东京活动相关网页的文本片段。
请从中抽取所有"具体的活动"(展览/市集/live/祭典),并以 JSON 数组输出。

严格要求:
- 只输出 JSON,不要任何解释、前后缀或 Markdown 代码围栏。
- 数组中每个对象的字段如下;无法确定的字段填 null。
- category 只能是: "EXHIBITION" | "MARKET" | "LIVE" | "FESTIVAL"
- 时间用 ISO 8601 字符串;若只有日期没有时间,补 T00:00:00。

字段:
{
  "title": string,
  "description": string | null,
  "category": "EXHIBITION" | "MARKET" | "LIVE" | "FESTIVAL",
  "venueName": string | null,
  "address": string | null,   // 尽量是可用于地理编码的完整地址
  "startTime": string | null,
  "endTime": string | null
}

网页文本:
"""
{{PAGE_TEXT}}
"""
```

在代码侧:安全解析返回(去围栏、`JSON.parse` 包 try/catch)、逐条做字段校验后再入库。

### 8.3 提取质量评测(eval)—— 重点练习项

- 维护一个小评测集:挑 20–50 个真实页面,人工标注"正确答案"(应抽出哪些活动、各字段值)。
- 跑提取后,与标注比对,统计:活动条目召回/精确率、各字段(尤其是 category、时间、地址)的准确率。
- 把它做成一个可重复运行的脚本(`scripts/eval-extraction.ts`),每次改 prompt 后跑一遍看指标变化。
- **这是把"感觉还行"变成"可量化"的关键,也是本项目最值得投入的 AI 训练点。**

---

## 9. 页面与路由清单(供 scaffold)

**页面(App Router):**
- `/` —— 地图页(默认)
- `/recommend` —— 推荐(瀑布流,v1 占位排序)
- `/me` —— 个人(打卡足迹 + 历史)

**API route handlers(保持薄):**
- `GET /api/events?minLat=&maxLat=&minLng=&maxLng=&category=&from=&to=` —— 按矩形范围 + 筛选查活动
- `GET /api/checkins` —— 我的打卡列表
- `POST /api/checkins` —— 新建打卡(文字/照片/评分,可选关联 eventId)

**Service 模块(领域逻辑都在这里):**
- `src/services/events.ts` —— 活动查询/写入
- `src/services/checkins.ts` —— 打卡查询/写入
- `src/services/extraction/` —— 采集、LLM 提取、地理编码、入库

**脚本:**
- `scripts/run-extraction.ts` —— 跑一次提取管线
- `scripts/eval-extraction.ts` —— 跑提取质量评测

---

## 10. 建议目录结构

```
.
├─ docker-compose.yml          # 本地 Postgres(postgis/postgis 镜像)
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # 地图
│  │  ├─ recommend/page.tsx
│  │  ├─ me/page.tsx
│  │  └─ api/
│  │     ├─ events/route.ts
│  │     └─ checkins/route.ts
│  ├─ components/
│  │  ├─ Map/                  # MapLibre 封装、pin、FAB
│  │  ├─ BottomNav.tsx
│  │  └─ ...
│  ├─ services/                # 领域逻辑(纯 TS,未来的迁移单元)
│  │  ├─ events.ts
│  │  ├─ checkins.ts
│  │  └─ extraction/
│  └─ lib/
│     ├─ db.ts                 # Prisma client
│     └─ llm.ts                # LLM 调用封装
├─ scripts/
│  ├─ run-extraction.ts
│  └─ eval-extraction.ts
└─ .env
```

## 11. 本地 Postgres(docker-compose 草案)

```yaml
services:
  db:
    image: postgis/postgis:16-3.4   # 普通 Postgres + 预装 PostGIS,v1 用不到 PostGIS 也无妨,免去日后重搭
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: tokyo_events
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

`.env` 示例:
```
DATABASE_URL="postgresql://dev:dev@localhost:5432/tokyo_events?schema=public"
LLM_API_KEY="..."          # 提取用模型的 key
GEOCODING_API_KEY="..."    # 地理编码服务 key(选型见开放问题)
NEXT_PUBLIC_MAP_TILES_URL="..."  # CARTO Positron / MapLibre 样式地址
```

---

## 12. 约定与非功能要求

- **单语言**:验证期全用 TypeScript。
- **不引入**:微服务、Kubernetes、消息队列、复杂缓存等(验证期一律不上)。
- **代码组织**:薄 route handler + 厚 service 层(见 5.2)。
- **隐私 / 合规(后置提醒)**:一旦 v2 开放 UGC,需考虑内容审核与日本相关法规(提供者责任、个人信息保护)。v1 单用户自用,暂不涉及,但不要在数据模型/代码里埋下难以合规的设计。
- **数字与时间**:统一用 UTC 存储,展示时转东京时区。

---

## 13. 给 Claude Code 的实现指令(摘要)

1. **范围**:只实现第 3 节的 v1 In-scope;v2/v3 一律不实现,用 `TODO` 标记挂载点。
2. **技术栈**:固定为第 5.1 节所列,不要替换。
3. **第一步建议顺序**:
   - 初始化 Next.js(App Router, TS)+ Prisma + `docker-compose.yml`。
   - 建 `schema.prisma`(按第 6.1 节),跑首次 migration。
   - 搭地图页:MapLibre + CARTO Positron 底图 + "我的位置" + 按可视范围调 `GET /api/events`。
   - 实现 `services/events.ts` 与 `/api/events`(矩形范围查询)。
   - 写 `scripts/run-extraction.ts`:对 1 个官方源跑通"采集→LLM 提取→地理编码→入库"的最小闭环(其余源后续按同一接口扩展)。
   - 搭打卡 FAB + `POST /api/checkins` + 个人页足迹展示。
   - 搭 `scripts/eval-extraction.ts` 的最小版本。
4. **保持薄 handler**:任何领域逻辑都写进 `src/services/*`。

---

## 14. 开放问题(实现前需我确认)

- **具体 5 个官方数据源**:最终选哪几个站点 / 接口(我会根据自己常去的区和类别确定)。
- **地理编码服务选型**:在额度/成本/精度间权衡(候选若干,待定)。
- **提取所用模型**:选哪个 LLM 做结构化提取(以结构化输出稳定性与成本为准)。
- **地图底图最终样式**:先用 CARTO Positron;风格切换器(浅色/暗色/暖调)留到 v1.5。

---

*本设计书覆盖到 v1 可落地的全部细节,并为 v1.5 / v2 / v3 标明了演进方向与挂载点。建议带入 Claude Code 后,先确认第 14 节的开放问题,再从第 13 节的实现顺序开始。*
