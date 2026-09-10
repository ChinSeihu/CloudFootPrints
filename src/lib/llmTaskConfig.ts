export type LlmTaskKey =
  | "extract.events"
  | "extract.classify"
  | "extract.summarize"
  | "extract.geocode"
  | "recommend.featured"
  | "guide.chat"
  | "guide.suggestions"
  | "guide.route"
  | "persona.chat"
  | "persona.daily"
  | "persona.social"
  | "persona.life-event"
  | "persona.memory"
  | "persona.signature"
  | "persona.image-prompt";

export type LlmTaskConfig = {
  thinking: "disabled" | "enabled";
  effort?: "low" | "high" | "max";
  maxTokens: number;
  timeoutMs?: number;
};

export const LLM_TASK_CONFIG: Record<LlmTaskKey, LlmTaskConfig> = {
  "extract.events": { thinking: "disabled", maxTokens: 4096 },
  "extract.classify": { thinking: "enabled", effort: "low", maxTokens: 1024 },
  "extract.summarize": { thinking: "disabled", maxTokens: 1024 },
  "extract.geocode": { thinking: "disabled", maxTokens: 128 },
  "recommend.featured": { thinking: "enabled", effort: "low", maxTokens: 500 },
  "guide.chat": { thinking: "enabled", effort: "low", maxTokens: 24000, timeoutMs: 180_000 },
  "guide.suggestions": { thinking: "disabled", maxTokens: 400 },
  "guide.route": { thinking: "enabled", effort: "high", maxTokens: 32000, timeoutMs: 180_000 },
  "persona.chat": { thinking: "enabled", effort: "low", maxTokens: 1200 },
  "persona.daily": { thinking: "enabled", effort: "high", maxTokens: 32000 },
  "persona.social": { thinking: "enabled", effort: "low", maxTokens: 1800 },
  "persona.life-event": { thinking: "enabled", effort: "high", maxTokens: 32000 },
  "persona.memory": { thinking: "enabled", effort: "low", maxTokens: 1600 },
  "persona.signature": { thinking: "enabled", effort: "low", maxTokens: 1000 },
  "persona.image-prompt": { thinking: "enabled", effort: "low", maxTokens: 2400 },
};

/**
 * Signature: `function llmTaskConfig(key: LlmTaskKey): LlmTaskConfig`
 * Purpose: Returns the single authoritative reasoning and output-budget policy for an LLM task.
 */
export function llmTaskConfig(key: LlmTaskKey): LlmTaskConfig {
  return LLM_TASK_CONFIG[key];
}

/**
 * Signature: `function deepSeekTaskOptions(key: LlmTaskKey): Record<string, unknown>`
 * Purpose: Converts a task policy into DeepSeek Chat Completions thinking parameters without duplicating provider syntax at call sites.
 */
export function deepSeekTaskOptions(key: LlmTaskKey): Record<string, unknown> {
  const config = llmTaskConfig(key);
  return config.thinking === "disabled"
    ? { thinking: { type: "disabled" } }
    : { thinking: { type: "enabled" }, reasoning_effort: config.effort ?? "low" };
}
