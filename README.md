# 东京活动地图（Tokyo Event Map）

> 在地图上一眼看全东京附近正在举行的活动（展览 / 市集 / live / 祭典 / 讲座）。
> **v1 = 验证 / 自用版**：单用户、本地优先；附带目标是练 LLM 结构化抽取 + 质量评测。

仓库：<https://github.com/ChinSeihu/CloudFootPrints>

---

## 功能

- **地图（主页）**
  - 活动与打卡都用 MapLibre **GeoJSON 聚类**渲染：同址/邻近点合并成带**数量**的气泡，放大到一定层级自动散开
  - 同位置/极近的多个活动 → **堆叠卡片弹窗**（一个弹窗里上下排列多张卡片）
  - 按**分类 / 日期 / "我的"** 筛选；分类色图例
  - **天气面板**（Open-Meteo，免费无 key）：当前温度 + 近 7 天 + 地图上层天气动画
  - 右上角 **🔄 刷新** 在线跑一次提取管线并把新活动写库
- **浮动操作按钮（FAB，两种动作）**
  - **打卡**："我来过这里"（个人足迹，文字/评分/照片）
  - **发帖**：在地图上落锚点标记"这里有个活动"（创建 `sourceType=USER` 的活动）
  - 落点是一枚**可拖动的锚点针**；表单为可下滑收起的底部 sheet
- **日历**：月历看当日活动（按东京时区分组），点活动看详情
- **推荐**：瀑布流卡片 → 点开**详情抽屉**（简介 + **评论** + **「在地图上查看」跳转**）
- **个人**：打卡足迹（地图 + 时间线）
- **删除**：可删自己的打卡与发帖
- **数据提取管线**：connpass / 东京都开放数据 / 本地样例 → **LLM 结构化抽取** → GSI 地理编码 → 入库；配套 **eval** 评测框架

## 技术栈

- **前端/服务端**：Next.js 16（App Router）+ TypeScript + Tailwind v4
- **数据库/ORM**：Prisma 7（pg driver adapter）+ PostgreSQL（Neon / Supabase 云端免费层）
- **地图**：MapLibre GL JS + CARTO Positron 底图
- **LLM（可切换 provider）**：DeepSeek（`deepseek-chat`，OpenAI 兼容 / JSON 模式）或 Claude（`claude-haiku-4-5`，tool use）
- **地理编码**：国土地理院（GSI）免费 API
- **天气**：Open-Meteo（免费无 key）

## 架构原则

- **薄 route handler + 厚 service 层**：领域逻辑全在 `src/services/*`，route handler 只解析参数、调 service、返回响应（为未来迁 Python 留门）。
- **数据库即接缝**；**来源无关**的数据模型（每条活动带 `sourceType` + `trustLevel`）。
- 只实现 v1；v2/v3（认证、审核、个性化推荐、社交整合、Python 服务）用 `TODO` 标注挂载点，不超前实现。

## 快速开始

```bash
# 1. 装依赖（npm 或 yarn 均可）
npm install

# 2. 生成 Prisma client（换机/首次必做，否则 API 全 500）
npx prisma generate

# 3. 配环境变量：复制 .env.example -> .env 并填值
copy .env.example .env      # macOS/Linux: cp .env.example .env

# 4. 建表
npm run db:migrate          # 或 npm run db:push 快速同步 schema

# 5. 起开发服务器
npm run dev                 # http://localhost:3000
```

> 没填 `DATABASE_URL` 也能起服务器看地图 UI，只是活动列表为空、打卡/发帖会失败。

## 环境变量（.env）

```ini
# 数据库（必填）：Neon / Supabase 连接串
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"

# LLM（提取 / 评测才需要，可切换 provider）
LLM_PROVIDER="deepseek"                       # deepseek | anthropic
LLM_API_KEY=""                                # 对应 provider 的 key
LLM_MODEL="deepseek-chat"                      # anthropic: claude-haiku-4-5
LLM_BASE_URL="https://api.deepseek.com"        # anthropic 留空

# 底图（CARTO Positron，免费）
NEXT_PUBLIC_MAP_STYLE_URL="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

# 数据源（可选；缺失则对应源跳过）
TOKYO_OPENDATA_RESOURCE_ID=""
CONNPASS_API_KEY=""
```

## 数据提取 & 评测

```bash
npm run extract   # 采集 → LLM 抽取 → 地理编码 → 入库
npm run eval      # 提取质量评测：召回/精确率、分类/时间准确率
```

- `extract` 默认跑全部已注册源：东京都开放数据、connpass、本地样例 fixtures。
  - **样例源**（`scripts/fixtures/*.txt`）无需任何 key 即可跑通端到端闭环。
  - 东京都开放数据 / connpass 需在 `.env` 配对应 id/key 才启用；未配置的源优雅跳过。
- `eval` 读取 `scripts/eval/dataset.json`（人工标注的真实页面），每次改 prompt/模型后重跑看指标变化。

## 目录结构

```
src/
  app/
    page.tsx                         # 地图页（主页）
    calendar/page.tsx                # 日历
    recommend/page.tsx               # 推荐瀑布流
    me/page.tsx                      # 个人：打卡足迹
    api/events/route.ts              # GET 范围查活动 / POST 发帖
    api/events/[id]/route.ts         # DELETE 发帖
    api/events/[id]/comments/route.ts# GET/POST 评论
    api/checkins/route.ts            # GET/POST 打卡
    api/checkins/[id]/route.ts       # DELETE 打卡
    api/extract/route.ts             # POST 触发提取管线
    api/weather/route.ts             # GET 天气
  components/
    BottomNav.tsx                    # 底部 4 tab：地图/日历/推荐/个人
    Map/                             # 地图、聚类、筛选、ActionFab、打卡/发帖弹窗、天气
    Calendar/  Recommend/  Me/
  services/                          # 领域逻辑（events/checkins/comments/weather/extraction）
  lib/                               # db / llm / categories / clipboard / types
scripts/  run-extraction.ts  eval-extraction.ts  fixtures/  eval/
prisma/schema.prisma                 # 数据模型：Event / CheckIn / Comment
```

## 协作 / Git 工作流

- **双 PC 开发**：仓库在两台机器间同步；换机后**先 `npx prisma generate`**。
- 每次功能完成：更新 `CHANGELOG.md` → `git commit` → `git push origin main`。
- 提交前跑 `npx tsc --noEmit`（`next dev` 的 Turbopack 不做严格类型检查）。
- 详见 `CLAUDE.md` / `DECISIONS.md` / `CHANGELOG.md`。

## 路线图

- **v1（当前）**：地图撒点 + 个人打卡/发帖，自己用顺手
- **v1.5**：锚点发帖完善、地图风格切换器、照片本地上传
- **v2**：多用户认证、内容审核、个性化推荐排序、向量检索（pgvector）
- **v3**：Next 退化为 BFF，重逻辑迁 Python（FastAPI）；谨慎整合社交平台

---

*v1 自用版，时间统一 UTC 存储、展示转东京时区；主题固定亮色。*
