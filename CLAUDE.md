@AGENTS.md

# Tokyo Event Map — 项目上下文

## 项目目标

在地图上一眼看全东京附近正在举行的活动（展览 / 市集 / live / 祭典）。v1 = 验证 / 自用版，单用户、本地优先。

## 技术栈

- Next.js 16（App Router）+ TypeScript + Tailwind v4
- Prisma 7（pg driver adapter）+ PostgreSQL（Neon / Supabase 云端免费层）
- MapLibre GL JS + CARTO Positron 底图
- 数据提取：Claude `claude-haiku-4-5`（tool use 结构化输出）+ 国土地理院 GSI 地理编码

## 架构原则

- **薄 route handler + 厚 service 层**：领域逻辑全在 `src/services/*`，route handler 只解析参数、调 service、返回响应
- 数据库即接缝；来源无关的数据模型（每条活动带 `sourceType` + `trustLevel`）
- v2/v3 功能（认证、审核、推荐排序、社交整合、Python 服务）未实现，用 `TODO` 标注挂载点

## 关键命令

```bash
npm run dev          # 开发服务器 http://localhost:3000
npm run extract      # 采集 → LLM 抽取 → 地理编码 → 入库
npm run eval         # 提取质量评测
npm run db:migrate   # 首次建表
npm run db:push      # 快速同步 schema（开发用）
```

## 协作流程（Git / 跨设备）

- **双 PC 开发**：两台机器间复制本仓库。换机后**先 `prisma generate`**（否则 `@prisma/client` 无 `PrismaClient` 导出、API 全 500）。
- **每次功能新增/变更完成后**：① 更新 `CHANGELOG.md`（涉及锁定决策时同步 `DECISIONS.md`）→ ② `git commit` → ③ `git push`（origin main）。保持 GitHub 实时同步，便于另一台机器接续。
- 远端：`https://github.com/ChinSeihu/CloudFootPrints`（用 **ChinSeihu** 账号推送，勿用工作账号）。
- 提交前：`next dev`（Turbopack）不跑严格 tsc，所以改完先跑 `npx tsc --noEmit`（或 `npm run build`）确保全绿。

## 环境变量（.env）

```
DATABASE_URL          # Neon / Supabase 连接串（必填）
LLM_API_KEY           # Anthropic API key（extract/eval 才需要）
TOKYO_OPENDATA_RESOURCE_ID  # 可选，东京都开放数据 CKAN resource id
CONNPASS_API_KEY      # 可选，connpass API
```

## 目录结构

```
src/
  app/
    page.tsx                        # 地图页（主页）
    recommend/page.tsx              # 推荐瀑布流
    me/page.tsx                     # 个人：打卡足迹 + 时间线
    api/events/route.ts             # GET 矩形范围查活动
    api/events/[id]/comments/route.ts
    api/checkins/route.ts           # GET/POST 打卡
    api/extract/route.ts            # POST 触发提取管线
  components/
    BottomNav.tsx                   # 底部 tab：地图/推荐/个人
    Map/                            # MapLibre 封装、pin、筛选、FAB、打卡弹窗
    Me/MeView.tsx
    Recommend/
  services/
    events.ts  checkins.ts  comments.ts
    extraction/                     # 采集/LLM抽取/地理编码/入库/数据源
  lib/
    db.ts  llm.ts  categories.ts  categoryIcons.ts  types.ts
scripts/
  run-extraction.ts
  eval-extraction.ts
  fixtures/   # 样例页面（无需 key 即可跑端到端）
  eval/       # 人工标注评测集 dataset.json
prisma/schema.prisma                # 数据模型：Event / CheckIn
```

## 分类枚举

`EXHIBITION / MARKET / LIVE / FESTIVAL / TALK / SPORTS / OTHER`

## 已知取舍 / 待办

- 打卡照片：v1 仅接受外链 URL，未做本地上传（TODO v1.5：`public/uploads`）
- 筛选：类别/日期为客户端筛选（API 已支持服务端参数）
- 地图风格切换器：留到 v1.5
- 时间统一 UTC 存储，展示转东京时区
