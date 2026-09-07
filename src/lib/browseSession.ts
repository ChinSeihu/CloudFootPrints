const BROWSE_SESSION_VERSION = 1;
const BROWSE_SESSION_PREFIX = "tem:browse:v1:";

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;
type EncodedValue = null | boolean | number | string | EncodedValue[] | { [key: string]: EncodedValue };

/**
 * Signature: `encodeValue(value: unknown): EncodedValue`
 * Purpose: Serializes browse UI values while preserving Set-based filters across page changes and reloads.
 */
function encodeValue(value: unknown): EncodedValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Set) return { $type: "Set", values: [...value].map(encodeValue) };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encodeValue(item)]));
  }
  throw new Error("Unsupported browse session value");
}

/**
 * Signature: `decodeValue(value: EncodedValue): unknown`
 * Purpose: Reconstructs JSON values and Set-based filters from a versioned tab session snapshot.
 */
function decodeValue(value: EncodedValue): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value.$type === "Set" && Array.isArray(value.values)) return new Set(value.values.map(decodeValue));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]));
}

/**
 * Signature: `readBrowseSession<T>(storage: SessionStorageLike, key: string): T | undefined`
 * Purpose: Safely reads a matching versioned snapshot and ignores missing, stale, or malformed browser data.
 */
export function readBrowseSession<T>(storage: SessionStorageLike, key: string): T | undefined {
  try {
    const raw = storage.getItem(`${BROWSE_SESSION_PREFIX}${key}`);
    if (!raw) return undefined;
    const envelope = JSON.parse(raw) as { version?: unknown; value?: EncodedValue };
    if (envelope.version !== BROWSE_SESSION_VERSION || !("value" in envelope)) return undefined;
    return decodeValue(envelope.value as EncodedValue) as T;
  } catch {
    return undefined;
  }
}

/**
 * Signature: `writeBrowseSession(storage: SessionStorageLike, key: string, value: unknown): void`
 * Purpose: Writes a versioned tab-local UI snapshot without allowing storage failures to interrupt browsing.
 */
export function writeBrowseSession(storage: SessionStorageLike, key: string, value: unknown): void {
  try {
    storage.setItem(`${BROWSE_SESSION_PREFIX}${key}`, JSON.stringify({ version: BROWSE_SESSION_VERSION, value: encodeValue(value) }));
  } catch {
    // Storage may be unavailable or full; in-memory restoration remains active.
  }
}
