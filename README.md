# 东京活动地图（Tokyo Event Map）— v1

在地图上一眼看全东京附近正在举行的活动（展览 / 市集 / live / 祭典）。**v1 = 验证 / 自用版**，单用户、本地优先。

## 技术栈

- Next.js 16（App Router）+ TypeScript + Tailwind v4
- Prisma 7（pg driver adapter）+ PostgreSQL（v1 用云端免费层：Neon / Supabase）
- MapLibre GL JS + CARTO Positron 底图
- 数据提取：Claude（`claude-haiku-4-5`，tool use 结构化输出）+ 国土地理院（GSI）免费地理编码

## 架构原则

- **薄 route handler + 厚 service 层**：领域逻辑全在 `src/services/*` 的纯函数里，route handler 只解析参数、调 service、返回响应。这是未来把重逻辑迁去 Python 的"迁移保险"。
- **数据库即接缝**；**来源无关**的数据模型（每条活动带 `sourceType` + `trustLevel`）。
- v2/v3 功能（认证、审核、推荐排序、社交整合、Python 服务）**未实现**，代码里用 `TODO` 标注挂载点。

## 快速开始

```bash
# 1. 装依赖
npm install

# 2. 配置环境变量：复制 .env.example -> .env，至少填这两项
#    DATABASE_URL  ：Neon / Supabase 的连接串
#    LLM_API_KEY   ：Anthropic API key（提取/评测才需要）
cp .env.example .env   # Windows: copy .env.example .env

# 3. 建表（首次迁移）
npm run db:migrate     # 或 npm run db:push 快速同步 schema

# 4. 起开发服务器
npm run dev            # http://localhost:3000
```

> 没填 `DATABASE_URL` 也能起服务器看地图 UI，只是活动列表为空、打卡会失败。

## 数据提取 & 评测

```bash
npm run extract   # 采集 → LLM 抽取 → 地理编码 → 入库
npm run eval      # 跑提取质量评测，输出召回/精确率、分类/时间准确率
```

- `extract` 默认跑全部已注册源：东京都开放数据、connpass、本地样例 fixtures。
  - **样例源**（`scripts/fixtures/*.txt`）无需任何 key 即可跑通端到端闭环。
  - **东京都开放数据**：在 `.env` 填 `TOKYO_OPENDATA_RESOURCE_ID`（含活动信息的 CKAN resource id）启用。
  - **connpass**：在 `.env` 填 `CONNPASS_API_KEY` 启用。
  - 未配置的源会优雅跳过。
- `eval` 读取 `scripts/eval/dataset.json`（人工标注的真实页面）。每次改 prompt/模型后重跑看指标变化。

**手动刷新（应用内）**：地图页右上角的 **🔄 刷新** 按钮会调 `POST /api/extract`，在线上跑同一条提取管线并把新活动写库，跑完自动把新点刷到地图。需要 `.env` 里配好 `LLM_API_KEY`（抽取要联网调 Claude）。

## 目录结构

```
src/
  app/
    page.tsx                 # 地图页（默认）
    recommend/page.tsx       # 推荐瀑布流（v1 占位排序）
    me/page.tsx              # 个人：打卡足迹 + 时间线
    api/events/route.ts      # GET 矩形范围查活动（薄）
    api/checkins/route.ts    # GET/POST 打卡（薄）
  components/
    BottomNav.tsx            # 底部 tab：地图/推荐/个人
    Map/                     # MapLibre 封装、pin、筛选、FAB、打卡弹窗
    Me/MeView.tsx
  services/                  # 领域逻辑（纯 TS，未来迁移单元）
    events.ts  checkins.ts
    extraction/              # 采集 / LLM 抽取 / 地理编码 / 入库 / 数据源
  lib/                       # db(Prisma) / llm(Anthropic) / categories / types
scripts/
  run-extraction.ts          # 跑一次提取管线
  eval-extraction.ts         # 跑提取质量评测
  fixtures/  eval/           # 样例页面 & 评测标注集
prisma/schema.prisma         # 数据模型（Event / CheckIn）
prisma.config.ts             # Prisma 7 配置（迁移用连接串）
docker-compose.yml           # 本地 Postgres（可选，默认用云端）
```

## 已知 v1 取舍 / 待办

- **打卡照片**：v1 仅接受外链 URL，未做本地上传存储（TODO v1.5：`public/uploads`）。
- **分类枚举**：`EXHIBITION / MARKET / LIVE / FESTIVAL / TALK / OTHER`（TALK 用于 connpass 等技术活动，OTHER 兜底）。
- **筛选**：类别/日期为客户端筛选（API 已支持服务端 `category`/`from`/`to` 参数）。
- **地图风格切换器**：留到 v1.5。
- 时间统一 UTC 存储，展示转东京时区。
