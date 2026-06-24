// 图片视觉质检（V7 Phase 4+）：用 Agnes 的多模态 chat 模型「看」生成图，判断是否合格；
// 不合格则产出「改进版英文 prompt」，供上层重生成。纯防御：任何失败视为「通过」（不打断出图）。

// 带超时的 fetch（避免质检请求卡住）。本地定义，避免与 image.ts 形成循环依赖。
async function fetchT(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

export type QAResult = { ok: boolean; reason: string; improvedPrompt: string | null };

const QA_SYSTEM = `你是生活照图片质检员。判断给定图片是否「合格」。
合格标准（全部满足才算合格）：
1. 符合给定的画面意图 / 场景；
2. 像真人用手机随手拍的生活照，没有明显 AI / CGI / 3D 渲染感、没有油光塑料皮肤、不过度锐化；
3. 若有人物：表情自然克制、不夸张、不像对镜摆拍；手指/肢体没有明显畸形；
4. 没有文字 / 水印 / logo。
不合格时，请基于原意图给出一版「改进后的英文图片生成 prompt」，针对性修正问题（更强调写实、自然表情、消除 AI 感等）。`;

function safeParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return null; }
}

// imageRef：可传图片 URL 或 data URI（Agnes 多模态 image_url 均支持）。
export async function judgeImage(imageRef: string, photoDesc: string, basePrompt: string): Promise<QAResult> {
  const base = process.env.AGNES_API_URL;
  const key = process.env.AGNES_API_KEY;
  const model = process.env.IMAGE_QA_MODEL || "agnes-2.0-flash";
  if (!base || !key) return { ok: true, reason: "QA 未配置，跳过", improvedPrompt: null };
  const endpoint = `${base.replace(/\/$/, "")}/chat/completions`;
  const ask = `画面意图：${photoDesc}\n参考的原始 prompt：${basePrompt}\n\n请判断这张图是否合格，只输出 JSON：{"ok": true/false, "reason": "简短中文原因", "improvedPrompt": "不合格时给改进后的英文 prompt，合格则 null"}`;
  try {
    const res = await fetchT(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [
          { role: "system", content: QA_SYSTEM },
          { role: "user", content: [
            { type: "text", text: ask },
            { type: "image_url", image_url: { url: imageRef } },
          ] },
        ],
      }),
    }, 60000);
    if (!res.ok) return { ok: true, reason: `QA 请求失败 ${res.status}，跳过`, improvedPrompt: null };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = safeParse(data.choices?.[0]?.message?.content ?? "") as { ok?: unknown; reason?: unknown; improvedPrompt?: unknown } | null;
    if (!parsed) return { ok: true, reason: "QA 解析失败，跳过", improvedPrompt: null };
    const ok = parsed.ok === true;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    const improvedPrompt = !ok && typeof parsed.improvedPrompt === "string" && parsed.improvedPrompt.trim() ? parsed.improvedPrompt.trim() : null;
    return { ok, reason, improvedPrompt };
  } catch {
    return { ok: true, reason: "QA 异常，跳过", improvedPrompt: null };
  }
}
