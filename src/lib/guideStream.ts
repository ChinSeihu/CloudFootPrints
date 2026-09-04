/**
 * Signature: `async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string>`
 * Purpose: Decodes UTF-8 SSE data across arbitrary network boundaries and releases the reader on cancellation.
 */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (done) buffer += "\n\n";
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line && data.length) { yield data.join("\n"); data = []; }
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
/**
 * Signature: `function partialGuideReply(json: string): string`
 * Purpose: Exposes only the decoded reply field from incomplete structured output, withholding unfinished escapes.
 */
export function partialGuideReply(json: string): string {
  const match = /"reply"\s*:\s*"/.exec(json);
  if (!match) return "";
  const start = match.index + match[0].length;
  let end = start;
  while (end < json.length) {
    if (json[end] === '"') break;
    if (json[end] === "\\") {
      const size = json[end + 1] === "u" ? 6 : 2;
      if (end + size > json.length) break;
      end += size;
    } else end++;
  }
  try { return JSON.parse('"' + json.slice(start, end) + '"') as string; }
  catch { return ""; }
}
