export type GoalStatus = "active" | "blocked" | "paused" | "completed" | "abandoned";

export type GoalState = {
  id: string;
  title: string;
  status: GoalStatus;
  progress: number;
  motivation: number;
  blocker?: string;
  nextStep?: string;
  updatedAt: string;
};

export type DailyRealityState = {
  energy: number;
  workload: number;
  socialBattery: number;
  budgetPressure: number;
};

export type GoalUpdate = {
  title: string;
  status?: GoalStatus;
  progressDelta?: number;
  motivationDelta?: number;
  blocker?: string;
  nextStep?: string;
};

const GOAL_STATUSES = new Set<GoalStatus>(["active", "blocked", "paused", "completed", "abandoned"]);
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

/**
 * Signature: `function resolveGoalStates(raw: unknown, goals: string[], dateKey: string): GoalState[]`
 * Purpose: Reads persisted goal progress and backfills legacy string goals without discarding new goals added by life events.
 */
export function resolveGoalStates(raw: unknown, goals: string[], dateKey: string): GoalState[] {
  const parsed: GoalState[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      if (typeof value.title !== "string" || !value.title.trim()) continue;
      const status = typeof value.status === "string" && GOAL_STATUSES.has(value.status as GoalStatus)
        ? value.status as GoalStatus : "active";
      parsed.push({
        id: typeof value.id === "string" && value.id ? value.id : `goal-${parsed.length + 1}`,
        title: value.title.trim(),
        status,
        progress: clamp(typeof value.progress === "number" ? value.progress : 0),
        motivation: clamp(typeof value.motivation === "number" ? value.motivation : 65),
        blocker: typeof value.blocker === "string" && value.blocker.trim() ? value.blocker.trim() : undefined,
        nextStep: typeof value.nextStep === "string" && value.nextStep.trim() ? value.nextStep.trim() : undefined,
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : dateKey,
      });
    }
  }
  for (const title of goals) {
    if (!parsed.some((goal) => goal.title === title)) {
      parsed.push({ id: `goal-${parsed.length + 1}`, title, status: "active", progress: 0, motivation: 65, updatedAt: dateKey });
    }
  }
  return parsed.slice(0, 8);
}

/**
 * Signature: `function resolveDailyRealityState(raw: unknown, emotion: Record<string, number>): DailyRealityState`
 * Purpose: Restores bounded practical constraints, deriving conservative defaults for character states created before this model existed.
 */
export function resolveDailyRealityState(raw: unknown, emotion: Record<string, number>): DailyRealityState {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const stress = emotion.stress ?? 50;
  const satisfaction = emotion.satisfaction ?? 50;
  return {
    energy: clamp(typeof value.energy === "number" ? value.energy : 72 - stress * 0.3 + satisfaction * 0.12),
    workload: clamp(typeof value.workload === "number" ? value.workload : 28 + stress * 0.45),
    socialBattery: clamp(typeof value.socialBattery === "number" ? value.socialBattery : 62 - stress * 0.18),
    budgetPressure: clamp(typeof value.budgetPressure === "number" ? value.budgetPressure : 35),
  };
}

/**
 * Signature: `function applyGoalUpdate(goals: GoalState[], update: GoalUpdate | null, dateKey: string): GoalState[]`
 * Purpose: Applies one bounded update only to an existing goal so a single generation cannot invent or abruptly complete a life direction.
 */
export function applyGoalUpdate(goals: GoalState[], update: GoalUpdate | null, dateKey: string): GoalState[] {
  if (!update) return goals;
  return goals.map((goal) => {
    if (goal.title !== update.title) return goal;
    const progressDelta = clamp(update.progressDelta ?? 0, -8, 12);
    const motivationDelta = clamp(update.motivationDelta ?? 0, -10, 10);
    const progress = clamp(goal.progress + progressDelta);
    let status = update.status ?? goal.status;
    if (status === "completed" && progress < 90) status = "active";
    return {
      ...goal,
      status,
      progress,
      motivation: clamp(goal.motivation + motivationDelta),
      blocker: update.blocker?.trim() || undefined,
      nextStep: update.nextStep?.trim() || undefined,
      updatedAt: dateKey,
    };
  });
}

/**
 * Signature: `function applyDailyRealityDelta(state: DailyRealityState, delta: Partial<DailyRealityState>): DailyRealityState`
 * Purpose: Applies limited day-to-day changes to practical constraints while keeping every dimension within 0–100.
 */
export function applyDailyRealityDelta(state: DailyRealityState, delta: Partial<DailyRealityState>): DailyRealityState {
  return {
    energy: clamp(state.energy + clamp(delta.energy ?? 0, -15, 15)),
    workload: clamp(state.workload + clamp(delta.workload ?? 0, -12, 12)),
    socialBattery: clamp(state.socialBattery + clamp(delta.socialBattery ?? 0, -15, 15)),
    budgetPressure: clamp(state.budgetPressure + clamp(delta.budgetPressure ?? 0, -8, 8)),
  };
}

/**
 * Signature: `function goalStatePrompt(goals: GoalState[]): string`
 * Purpose: Formats goal progress as explicit decision context without exposing storage details to the model.
 */
export function goalStatePrompt(goals: GoalState[]): string {
  return goals.map((goal) => {
    const details = [goal.nextStep && `下一步:${goal.nextStep}`, goal.blocker && `阻碍:${goal.blocker}`].filter(Boolean).join("；");
    return `- ${goal.title}｜${goal.status}｜进度${goal.progress}｜动机${goal.motivation}${details ? `｜${details}` : ""}`;
  }).join("\n") || "（无）";
}
