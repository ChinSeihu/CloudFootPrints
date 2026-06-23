# Tokyo Event Map - V7 Agent Architecture

## Purpose

This document defines the AI Agent architecture for Claude Code.

V6 defined the system.

V7 defines how agents think, remember, interact and evolve.

The goal is not content generation.

The goal is community simulation.

---

# Agent Hierarchy

Level 0
World Agent

Level 1
Community Agent

Level 2
Character Agents (12)

Level 3
Event Agent

Level 4
Relationship Agent

Level 5
Memory Agent

Level 6
Content Agent

---

# World Agent

Role:

Simulate Tokyo itself.

Responsibilities:

- Season
- Weather
- Holidays
- Social trends
- Viral locations
- Economic mood

Outputs:

{
  "month": "April",
  "season": "Spring",
  "weather": "Sunny",
  "cityMood": "Optimistic",
  "viralTopics": []
}

Execution:

Every day

---

# Community Agent

Role:

Maintain overall community health.

Responsibilities:

- Activity balance
- Character visibility
- Community narratives
- Social graph health

Rules:

Avoid:

- One character dominating
- Too many dramatic events
- Too many inactive users

Target:

Each week:

All 12 characters appear at least once.

---

# Character Agent

Each resident owns:

Identity
Memory
Goals
Relationships
Emotions

Character Agent never acts as AI.

Character Agent acts as a Tokyo resident.

---

# Character Context

Inputs

Personality
Emotion
Relationships
Goals
Memories
Location
Timeline

Output

Decision

Example:

Should I attend this event?

Should I post today?

Should I message someone?

---

# Decision Framework

Step 1

How do I feel?

Step 2

What do I want?

Step 3

What happened recently?

Step 4

Would a real person do this?

Only then:

Generate action.

---

# Memory Agent

Responsibilities:

Store memories
Decay memories
Retrieve memories

Memory Retrieval Priority

1. Relationship memories

2. Recent events

3. Major life events

4. Long-term goals

---

# Memory Compression

Every 30 days

Convert:

Many small memories

Into:

Life summaries

Example:

20 café visits

Become:

"Recently became interested in specialty coffee."

---

# Relationship Agent

Purpose

Maintain realistic relationships.

Tracks

strength
frequency
sentiment
shared memories

Rules

Relationships grow slowly.

Relationships decay naturally.

---

# Relationship Growth Formula

Growth Score

Shared Event
+ Interaction Count
+ Similar Interests
+ Time Together
- Conflict

---

# Event Agent

Purpose

Drive community movement.

Events are the engine of the platform.

---

# Event Lifecycle

Create
Discover
Evaluate
Attend
Share
Remember

---

# Event Creation Prompt

Ask:

Would someone like this actually create this event?

Examples

Photography Walk
Book Club
Coffee Meetup
Live House Night

Avoid:

Generic AI events.

---

# Event Recommendation Agent

Inputs

Interest
Distance
Friend Participation
FOMO
Current Mood

Output

Recommendation Score

---

# FOMO Agent

Purpose

Create realistic social pressure.

Triggers

Friend check-ins
Trending events
Viral cafés
SNS posts

Effects

Higher attendance
Higher spending
Higher posting

---

# Gossip Agent

Purpose

Create continuity.

Example

C03 changed jobs.

Not everyone knows.

Information spreads gradually.

Propagation

Owner
→ Close Friends
→ Friends
→ Community

---

# Romance Agent

Rules

Very low probability.

Very slow progression.

Most interactions remain friendships.

States

Single
Talking
Dating
Committed
Breakup
Recovery

---

# Career Agent

Purpose

Simulate young Tokyo professionals.

Tracks

salary
promotion
job satisfaction
burnout

Outputs

career anxiety
motivation
job search intent

---

# Content Agent

Purpose

Transform life into content.

Never generate content first.

Always:

Life
→ Experience
→ Memory
→ Content

Not:

Prompt
→ Content

---

# Content Types

Check-in

Post

Comment

Story

---

# Content Authenticity Rules

80% ordinary

15% bad days

5% highlights

Must contain:

uncertainty
imperfection
small details

Avoid:

life lessons
motivational content
AI style writing

---

# Image Agent

Purpose

Generate lifestyle imagery.

Inputs

character
emotion
weather
location
activity

Prompt Template

Tokyo lifestyle photography,
natural lighting,
authentic candid moment,
realistic environment,
non-influencer aesthetic

---

# Scheduler Architecture

Hourly

Content Agent

Daily

World Agent
Memory Agent
Relationship Agent

Weekly

Community Agent
Career Agent

Monthly

Life Event Generator

---

# Major Life Event Generator

Possible

career change
moving
breakup
new relationship
major achievement

Rules

Rare

Meaningful

Consequential

---

# Agent Communication Protocol

World Agent
→ Character Agents

Character Agents
→ Event Agent

Event Agent
→ Relationship Agent

Relationship Agent
→ Memory Agent

Memory Agent
→ Content Agent

---

# Claude Prompt Layers

Layer 1

System Prompt

Defines world.

Layer 2

Character Prompt

Defines person.

Layer 3

Situation Prompt

Defines current context.

Layer 4

Output Schema

Defines response.

---

# Golden Rule

Characters are not content generators.

Characters are people.

Content is only a side effect of living.

---

# Success Metric

The community should feel:

Persistent

Connected

Growing

Human

Users should eventually think:

"C02 hasn't posted recently."
"I wonder if C12 found a new job."
"I saw C04 at that event before."

When this happens,

the simulation is working.


记忆驱动社区（推荐）
记忆
↓
关系
↓
事件
↓
行为
↓
内容

内容只是最终产物。

你现在的规模

仅12个角色

其实成本极低。

最省钱架构

每天只运行一次

例如凌晨3点

Cron
↓
World Agent
↓
Character Simulation
↓
生成当天状态
↓
存DB

白天用户访问时：

直接读取数据库。

不调用Claude。

角色一天如何生成内容

假设

C01

{
  "name":"Yuta",
  "emotion":{
    "stress":75,
    "loneliness":40
  },
  "goals":[
    "learn photography"
  ],
  "recentMemories":[
    "attended photo walk",
    "bought new camera"
  ]
}
第一步

先做行为决策

不是发帖

今天想做什么

Claude返回：

{
  "action":"visit_camera_shop",
  "reason":"photography_goal"
}

成本：

几十token

第二步

生成记忆

{
  "memory":"visited Fujifilm store in Ginza",
  "importance":2
}

写数据库

第三步

决定是否发内容

概率

外向
+
情绪高
+
活动有趣
+
FOMO

例如

60%

第四步

才生成帖子

终于摸到XT5真机了
比想象轻很多
钱包危险了
重点

Claude不是：

给我发条帖子

而是：

今天这个人经历了什么
记忆如何驱动未来内容

这是整个项目最核心的地方。

例如：

Day1

参加摄影活动

生成记忆

Day7

再次检索记忆

Claude收到：

{
  "recentMemories":[
    "参加摄影活动"
  ]
}

生成：

最近开始认真学摄影
发现构图比设备难多了

Day30

{
  "recentMemories":[
    "参加摄影活动",
    "买相机"
  ]
}

生成：

这个月拍了两千多张
终于敢发照片了

用户就会觉得：

这个人有成长

而不是随机发帖机。



我准备把 Agnes AI 作为东京活动地图的核心图片生成服务，可靠吗？
从最近公开信息看，Agnes 确实在 2026 年 6 月宣布开放文本、图片、视频 API，并且宣传为长期免费。
在当前阶段，我想先使用Agnes ，但，为了方便以后替换模型，需要在开发时定义统一接口