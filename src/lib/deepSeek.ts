export type DeepSeekRequestBody = Record<string, unknown> & { model?: string };

type DeepSeekChoice = {
  finish_reason?: string | null;
  message?: { content?: string | null; reasoning_content?: string | null };
};

/**
 * Signature: `function deepSeekModel(configured?: string): string`
 * Purpose: Returns the configured model or the current DeepSeek V4.1 Flash API name.
 */
export function deepSeekModel(configured = process.env.LLM_MODEL): string {
  return configured || "deepseek-flash";
}

/**
 * Signature: `async function requestDeepSeekContent(baseUrl: string, apiKey: string, body: DeepSeekRequestBody, signal?: AbortSignal): Promise<string>`
 * Purpose: Requires visible content and degrades from thinking JSON to non-thinking JSON, then non-thinking prompt-only JSON when needed.
 */
export async function requestDeepSeekContent(baseUrl: string, apiKey: string, body: DeepSeekRequestBody, signal?: AbortSignal): Promise<string> {
  let lastError: Error | null = null;
  const thinking = body.thinking as { type?: unknown } | undefined;
  const stages = [
    { disableThinking: false, removeJsonMode: false },
    ...(thinking?.type === "disabled" ? [] : [{ disableThinking: true, removeJsonMode: false }]),
    ...(body.response_format ? [{ disableThinking: true, removeJsonMode: true }] : []),
  ];
  for (let attempt = 0; attempt < stages.length; attempt++) {
    const stage = stages[attempt];
    const requestBody: DeepSeekRequestBody = { ...body, model: deepSeekModel(typeof body.model === "string" ? body.model : undefined) };
    if (stage.disableThinking) {
      requestBody.thinking = { type: "disabled" };
      delete requestBody.reasoning_effort;
    }
    if (stage.removeJsonMode) {
      delete requestBody.response_format;
    }
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const error = new Error(`DeepSeek ${response.status}: ${detail.slice(0, 300)}`);
        if (attempt < stages.length - 1 && (response.status === 429 || response.status >= 500)) { lastError = error; continue; }
        throw error;
      }
      const data = (await response.json()) as { choices?: DeepSeekChoice[] };
      const choice = data.choices?.[0];
      const content = choice?.message?.content?.trim() ?? "";
      if (content) return content;
      lastError = new Error(`DeepSeek returned no content (finish_reason=${choice?.finish_reason ?? "missing"}, reasoning=${Boolean(choice?.message?.reasoning_content)})`);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < stages.length - 1) console.warn(JSON.stringify({
      level: "warn",
      message: stages[attempt + 1].removeJsonMode ? "DeepSeek content retry without JSON mode" : "DeepSeek content retry without thinking",
      error: lastError.message,
    }));
  }
  throw lastError ?? new Error("DeepSeek returned no content");
}
