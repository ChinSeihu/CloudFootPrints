# PersonaV2 Migration Guide

Version: V2

Purpose:
Explain the design philosophy behind PersonaV2 and prevent future implementations from regressing to the old fixed-location model.

---

# Why PersonaV1 Failed

Old model:

```ts
home
+
3~5 fixed roam locations
+
occupation
```

Example:

```ts
home: "渋谷"

roam: [
  "代官山",
  "恵比寿",
  "中目黒"
]
```

Result after simulation:

* Characters repeatedly appear in the same places
* Content diversity decreases over time
* Exploration behavior disappears
* Timeline becomes predictable
* Characters feel like NPCs

After 30~60 simulated days:

```text
さくら:
代官山 → 咖啡馆

代官山 → 咖啡馆

代官山 → 咖啡馆
```

The system becomes repetitive.

This is NOT how real Tokyo residents behave.

---

# Core Philosophy Of PersonaV2

PersonaV2 is identity-driven.

Not location-driven.

Old:

```text
Location
→ Behavior
→ Content
```

New:

```text
Identity
→ Motivation
→ Decision
→ Location
→ Content
```

Characters choose locations because of goals.

Locations do not define characters.

---

# Archetype Is More Important Than Occupation

Occupation should never directly determine content.

Bad:

```ts
occupation:
"Wedding Planner"

=> only posts wedding related content
```

Good:

```ts
occupation:
"Brand Content Editor"

archetype:
"Gentle Lifestyle Creator"
```

Content generation must primarily reference:

1. archetype
2. interests
3. emotional state
4. memories
5. current goal

Occupation is background context only.

Weight recommendation:

```text
archetype        40%
interest         25%
memory           15%
emotion          10%
occupation       10%
```

---

# Home Area Is Not A Constraint

homeArea only indicates:

* where the character lives
* where they start most days

homeArea DOES NOT define activity range.

Bad:

```text
Lives in Shimokitazawa

→ always stays in Shimokitazawa
```

Good:

```text
Lives in Shimokitazawa

→ may go to:
  Shibuya
  Kichijoji
  Yokohama
  Kamakura
  Atami
```

depending on motivation.

---

# Frequent Areas

frequentAreas are preferences.

NOT hard constraints.

When generating activities:

```text
60% frequentAreas

40% outside areas
```

Recommended.

---

# Exploration Areas

explorationAreas are inspiration pools.

Characters should regularly visit them.

Recommended probability:

```text
weekday:
15~25%

weekend:
35~60%
```

depending on personality.

---

# Mobility Profile

This is now the primary movement system.

Example:

```ts
mobilityProfile: {
  explorationProbability: 0.85
}
```

Meaning:

The character actively seeks new places.

NOT:

```text
85% chance to travel
```

but:

```text
85% tendency toward novelty
```

---

# Friends Influence Movement

Friend activities should influence destination selection.

Example:

```text
Friend posted:

"Great exhibition in Roppongi"

↓

FOMO triggered

↓

Character visits within 7 days
```

This is required.

---

# FOMO Driven Discovery

Characters should discover locations through:

1. friends
2. social feed
3. trends
4. seasonal events

Not only through their own interests.

Recommended source weights:

```text
Own preference      45%
Friends             25%
Trend               20%
Random              10%
```

---

# Memory Driven Decisions

Characters must remember experiences.

Example:

Memory:

```text
Visited Kamakura with friends.
```

Future effects:

* increased revisit chance
* emotional bonus
* friend interaction bonus

Memory must influence behavior.

Otherwise the character is stateless.

---

# Tokyo Is The Main Character

Characters are not the center.

Tokyo is.

The system should simulate:

* seasons
* weather
* festivals
* exhibitions
* trending cafes
* train access
* social events

Characters react to Tokyo.

Not the other way around.

---

# Archetype Categories

Current ecosystem:

```text
C01 文艺观察
C02 设计生活
C03 温柔生活记录
C04 都市白领
C05 City Walk
C06 旅行
C07 疗愈生活
C08 Live House
C09 古着生活
C10 摄影
C11 留学生生活
C12 宠物生活
C13 甜品探店
```

These archetypes are intentionally content-oriented.

Do NOT convert them back into occupation-oriented personas.

---

# Content Generation Priority

When generating a post:

Step 1

Current emotion

Step 2

Current goal

Step 3

Recent memory

Step 4

Current season

Step 5

Current location

Step 6

Writing style

Only then generate content.

Never start with location.

Bad:

```text
Went to cafe.

How do I feel?
```

Good:

```text
Feeling lonely.

Need a quiet place.

Went to cafe.

Wrote post.
```

---

# Success Criteria

After 365 simulation days:

Good:

* characters evolve
* locations diversify
* friendships strengthen
* memories accumulate
* content changes

Bad:

* same locations
* same content
* same emotions
* no memory impact

If a character behaves identically after 365 days,

the simulation has failed.
