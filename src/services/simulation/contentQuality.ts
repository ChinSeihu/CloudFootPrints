import { PERSONA_WRITING_DNA, type PersonaV2 } from "@/lib/personas";
import type { DailyRealityState } from "./characterState";
import type { ActivitySignal } from "./activityImpact";

export type ContentQualityResult = {
  ok: boolean;
  issues: string[];
  memoryUnsafe: boolean;
};

export type ContentQualityInput = {
  persona: PersonaV2;
  publicText?: string | null;
  memoryText?: string | null;
  recentTexts?: string[];
  dailyState: DailyRealityState;
  activitySignals?: ActivitySignal[];
  requireMemory?: boolean;
  minimumPublicLength?: number;
};

const assistantPhrases = ["作为一个AI", "作为AI", "建议您", "希望以上", "以下是", "如果你愿意，我可以"];
const completionPhrases = ["参加了", "去了", "看完了", "逛完了", "到访", "行ってきた", "参加した", "見てきた"];

function normalizedChars(text: string): string[] {
  return Array.from(text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ""));
}

function bigrams(text: string): Set<string> {
  const chars = normalizedChars(text);
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
}

function similarity(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.size < 5 || b.size < 5) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return (2 * overlap) / (a.size + b.size);
}

function activityTitleMentioned(text: string, title: string): boolean {
  const normalizedText = normalizedChars(text).join("");
  const normalizedTitle = normalizedChars(title).join("");
  if (normalizedTitle.length < 4) return normalizedText.includes(normalizedTitle);
  return normalizedText.includes(normalizedTitle.slice(0, Math.min(10, normalizedTitle.length)));
}

/**
 * Signature: `function assessPersonaContent(input: ContentQualityInput): ContentQualityResult`
 * Purpose: Applies deterministic, low-cost checks for voice drift, repetition, factual status mistakes, and obvious practical-state contradictions.
 */
export function assessPersonaContent(input: ContentQualityInput): ContentQualityResult {
  const publicText = input.publicText?.trim() ?? "";
  const memoryText = input.memoryText?.trim() ?? "";
  const combined = [publicText, memoryText].filter(Boolean).join("\n");
  const issues: string[] = [];
  let memoryUnsafe = false;

  if (!memoryText && input.requireMemory !== false) {
    issues.push("缺少当天私下记忆");
    memoryUnsafe = true;
  }
  if (publicText && Array.from(publicText).length < (input.minimumPublicLength ?? 8)) issues.push("公开内容过短，缺少具体瞬间");
  if (Array.from(publicText).length > 220) issues.push("公开内容过长");
  if (Array.from(memoryText).length > 180) {
    issues.push("私下记忆过长");
    memoryUnsafe = true;
  }

  const dna = input.persona.writingDNA ?? PERSONA_WRITING_DNA[input.persona.id];
  for (const phrase of assistantPhrases) {
    if (combined.includes(phrase)) issues.push(`出现助手式表达「${phrase}」`);
    if (memoryText.includes(phrase)) memoryUnsafe = true;
  }
  for (const phrase of dna?.avoidWords ?? []) {
    if (phrase && publicText.includes(phrase)) issues.push(`出现人物禁用表达「${phrase}」`);
  }

  if (publicText && (input.recentTexts ?? []).some((recent) => similarity(publicText, recent) >= 0.72)) {
    issues.push("与近期公开内容高度重复");
  }

  const tentative = (input.activitySignals ?? []).filter((signal) => signal.kind !== "attended");
  for (const signal of tentative) {
    if (activityTitleMentioned(combined, signal.title) && completionPhrases.some((phrase) => combined.includes(phrase))) {
      issues.push(`把尚未参加的「${signal.title}」写成了已发生`);
      if (memoryText && activityTitleMentioned(memoryText, signal.title)) memoryUnsafe = true;
    }
  }

  if (input.dailyState.budgetPressure >= 80 && /爆买|大采购|奢侈|豪华消费|散財/.test(combined)) {
    issues.push("高预算压力下出现无解释的大额消费");
    if (/爆买|大采购|奢侈|豪华消费|散財/.test(memoryText)) memoryUnsafe = true;
  }
  if (input.dailyState.energy <= 20 && /通宵|一整天跑|连续去了|徹夜/.test(combined)) {
    issues.push("极低精力下出现无解释的高强度行动");
    if (/通宵|一整天跑|连续去了|徹夜/.test(memoryText)) memoryUnsafe = true;
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)], memoryUnsafe };
}

/**
 * Signature: `function qualityRewriteInstruction(result: ContentQualityResult, previous: unknown): string`
 * Purpose: Turns deterministic rejection reasons into one bounded same-model rewrite request.
 */
export function qualityRewriteInstruction(result: ContentQualityResult, previous: unknown): string {
  return `\n\n【上一稿质量检查未通过】\n- ${result.issues.join("\n- ")}\n上一稿：${JSON.stringify(previous)}\n请修正上述问题，保持原人物事实与当天情境，重新输出完整 JSON。不要解释修改过程。`;
}
