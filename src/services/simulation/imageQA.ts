async function fetchT(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type QAResult = { ok: boolean; reason: string; improvedPrompt: string | null };

const QA_SYSTEM = `You are a very strict quality reviewer for generated lifestyle photos.
Judge whether the image is acceptable. If any hard failure is present, return ok=false.

Acceptance criteria:
1. The image must match the intended scene, activity, subject and atmosphere.
2. It must look like a real casual Tokyo smartphone photo. Slight blur, noise, grain, imperfect exposure and imperfect framing are acceptable.
3. Reject obvious AI aesthetics: CGI or 3D render feel, waxy/plastic skin, over-smoothed skin, over-sharpening, excessive HDR, studio lighting, commercial fashion-shoot look, influencer posing, overly perfect composition, melted background details, repeated textures or impossible objects.
4. If people are visible, faces and expressions must be natural and restrained. Eyes, teeth, hair edges and facial proportions must not be visibly distorted.
5. Hands and anatomy are hard checks. Reject images with extra or missing fingers, fused fingers, warped palms, twisted wrists, misplaced arms, broken joints, impossible body proportions, or implausible ways of holding objects. If hands are hidden, out of frame, or too blurred to judge and no clear defect is visible, that is acceptable.
6. Reject text, watermark, logo, strange symbols or poster-like typography.

When rejecting, write a corrected English image prompt that fixes the specific issue while preserving the original intent. The improved prompt must include: documentary smartphone photo, natural hands and anatomy, realistic skin texture, subtle 35mm film grain, muted film colors, imperfect casual framing.`;

function safeParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export async function judgeImage(imageRef: string, photoDesc: string, basePrompt: string): Promise<QAResult> {
  const base = process.env.AGNES_API_URL;
  const key = process.env.AGNES_API_KEY;
  const model = process.env.IMAGE_QA_MODEL || "agnes-2.0-flash";
  if (!base || !key) return { ok: true, reason: "QA not configured, skipped", improvedPrompt: null };

  const endpoint = `${base.replace(/\/$/, "")}/chat/completions`;
  const ask = [
    `Intended scene: ${photoDesc}`,
    `Original prompt: ${basePrompt}`,
    "",
    "Check scene match, AI/CGI feel, skin texture, hands, anatomy, face, teeth, eyes, hair, text/watermarks.",
    'Return JSON only: {"ok": true/false, "reason": "short Chinese reason; if rejected name the main defect", "improvedPrompt": "corrected English prompt when rejected, otherwise null"}',
  ].join("\n");

  try {
    const res = await fetchT(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          { role: "system", content: QA_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: ask },
              { type: "image_url", image_url: { url: imageRef } },
            ],
          },
        ],
      }),
    }, 60000);
    if (!res.ok) return { ok: true, reason: `QA request failed ${res.status}, skipped`, improvedPrompt: null };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = safeParse(data.choices?.[0]?.message?.content ?? "") as { ok?: unknown; reason?: unknown; improvedPrompt?: unknown } | null;
    if (!parsed) return { ok: true, reason: "QA parse failed, skipped", improvedPrompt: null };

    const ok = parsed.ok === true;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    const improvedPrompt = !ok && typeof parsed.improvedPrompt === "string" && parsed.improvedPrompt.trim()
      ? parsed.improvedPrompt.trim()
      : null;
    return { ok, reason, improvedPrompt };
  } catch {
    return { ok: true, reason: "QA exception, skipped", improvedPrompt: null };
  }
}
