import sharp from "sharp";

const USER_AGENT = "tokyo-event-map/0.1 (official-event-image-check)";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type OfficialImageCandidate = {
  url: string;
  width: number;
  height: number | null;
};

/**
 * Signature: `function normalizeHttpUrl(value: string, baseUrl: string): string | null`
 * Purpose: Resolves an HTML image reference while rejecting non-HTTP and SVG assets.
 */
function normalizeHttpUrl(value: string, baseUrl: string): string | null {
  try {
    const decoded = value.replaceAll("&amp;", "&").trim();
    const url = new URL(decoded, baseUrl);
    if (!/^https?:$/.test(url.protocol) || /\.svg(?:$|\?)/i.test(url.href)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Signature: `function readAttribute(tag: string, name: string): string | null`
 * Purpose: Reads one quoted HTML attribute regardless of its position within a meta tag.
 */
function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2]?.trim() || null;
}

/**
 * Signature: `function extractSocialImageUrl(html: string, pageUrl: string): string | null`
 * Purpose: Extracts the first valid Open Graph or Twitter image URL from an official activity page.
 */
export function extractSocialImageUrl(html: string, pageUrl: string): string | null {
  const priorities = ["og:image:secure_url", "og:image", "twitter:image"];
  const candidates = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (readAttribute(tag, "property") ?? readAttribute(tag, "name"))?.toLowerCase();
    const content = readAttribute(tag, "content");
    if (key && content && priorities.includes(key) && !candidates.has(key)) candidates.set(key, content);
  }
  for (const key of priorities) {
    const value = candidates.get(key);
    if (!value) continue;
    const normalized = normalizeHttpUrl(value, pageUrl);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Signature: `async function fetchWithTimeout(url: string): Promise<Response | null>`
 * Purpose: Fetches one remote page or image with a bounded wait and a crawler-identifying user agent.
 */
async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/**
 * Signature: `async function readRemoteImageSize(imageUrl: string): Promise<{ width: number; height: number | null } | null>`
 * Purpose: Verifies the decoded dimensions of a remote image without accepting unexpectedly large payloads.
 */
async function readRemoteImageSize(imageUrl: string): Promise<{ width: number; height: number | null } | null> {
  const response = await fetchWithTimeout(imageUrl);
  if (!response) return null;
  const declaredBytes = Number(response.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_IMAGE_BYTES) return null;
  try {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return null;
    const metadata = await sharp(bytes).metadata();
    return metadata.width ? { width: metadata.width, height: metadata.height ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Signature: `async function findHighResolutionOfficialImage(pageUrl: string, minimumWidth?: number): Promise<OfficialImageCandidate | null>`
 * Purpose: Finds and dimension-checks an official page's social preview image before it replaces a known thumbnail.
 */
export async function findHighResolutionOfficialImage(
  pageUrl: string,
  minimumWidth = 640,
): Promise<OfficialImageCandidate | null> {
  const normalizedPageUrl = normalizeHttpUrl(pageUrl, pageUrl);
  if (!normalizedPageUrl) return null;
  const page = await fetchWithTimeout(normalizedPageUrl);
  if (!page) return null;
  const imageUrl = extractSocialImageUrl(await page.text(), normalizedPageUrl);
  if (!imageUrl) return null;
  const dimensions = await readRemoteImageSize(imageUrl);
  if (!dimensions || dimensions.width < minimumWidth) return null;
  return { url: imageUrl, ...dimensions };
}

/**
 * Signature: `function isWalkerplusThumbnail(imageUrl: string | null): boolean`
 * Purpose: Identifies the small WalkerPlus image variant that must not be stretched into a detail hero.
 */
export function isWalkerplusThumbnail(imageUrl: string | null): boolean {
  return Boolean(imageUrl && /ms-cache\.walkerplus\.com\/walkertouch\/wtd\/event\/\d+\/l\//i.test(imageUrl));
}

/**
 * Signature: `function isWalkerplusPage(pageUrl: string): boolean`
 * Purpose: Detects WalkerPlus pages so the thumbnail source is not mistaken for an independent official page.
 */
export function isWalkerplusPage(pageUrl: string): boolean {
  try {
    return /(^|\.)walkerplus\.com$/i.test(new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}
