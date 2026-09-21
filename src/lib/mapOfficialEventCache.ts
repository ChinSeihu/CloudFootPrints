import type { EventWithCoordinates } from "@/lib/types";
import type { BBox } from "@/services/events";

const DATABASE_NAME = "cloud-footprints-map-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "official-event-regions";
const CACHE_VERSION = "v1";
const GRID_DEGREES = 0.025;
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type OfficialEventCacheRegion = BBox & { key: string };

type OfficialEventCacheEntry = {
  key: string;
  savedAt: number;
  events: EventWithCoordinates[];
};

let databasePromise: Promise<IDBDatabase | null> | null = null;

/**
 * Signature: `function officialEventCacheRegion(bounds: BBox): OfficialEventCacheRegion`
 * Purpose: Expands a viewport to a stable geographic grid so nearby movements reuse the same official-event cache.
 */
export function officialEventCacheRegion(bounds: BBox): OfficialEventCacheRegion {
  const minLat = Number((Math.floor(bounds.minLat / GRID_DEGREES) * GRID_DEGREES).toFixed(4));
  const maxLat = Number((Math.ceil(bounds.maxLat / GRID_DEGREES) * GRID_DEGREES).toFixed(4));
  const minLng = Number((Math.floor(bounds.minLng / GRID_DEGREES) * GRID_DEGREES).toFixed(4));
  const maxLng = Number((Math.ceil(bounds.maxLng / GRID_DEGREES) * GRID_DEGREES).toFixed(4));
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    key: `${CACHE_VERSION}:${minLat}:${maxLat}:${minLng}:${maxLng}`,
  };
}

/**
 * Signature: `function openOfficialEventCacheDatabase(): Promise<IDBDatabase | null>`
 * Purpose: Opens the browser database used only for public official-event map snapshots.
 */
function openOfficialEventCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

/**
 * Signature: `async function readOfficialEventCache(region: OfficialEventCacheRegion): Promise<EventWithCoordinates[] | null>`
 * Purpose: Returns a recent official-event snapshot for immediate map rendering without blocking on the network.
 */
export async function readOfficialEventCache(region: OfficialEventCacheRegion): Promise<EventWithCoordinates[] | null> {
  const database = await openOfficialEventCacheDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(region.key);
    request.onsuccess = () => {
      const entry = request.result as OfficialEventCacheEntry | undefined;
      if (!entry || Date.now() - entry.savedAt > CACHE_MAX_AGE_MS) {
        resolve(null);
        return;
      }
      resolve(entry.events);
    };
    request.onerror = () => resolve(null);
  });
}

/**
 * Signature: `async function writeOfficialEventCache(region: OfficialEventCacheRegion, events: EventWithCoordinates[]): Promise<void>`
 * Purpose: Stores a refreshed official-event grid snapshot and removes obsolete regional snapshots.
 */
export async function writeOfficialEventCache(region: OfficialEventCacheRegion, events: EventWithCoordinates[]): Promise<void> {
  const database = await openOfficialEventCacheDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key: region.key, savedAt: Date.now(), events } satisfies OfficialEventCacheEntry);
    const cutoff = Date.now() - CACHE_RETENTION_MS;
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const entry = cursor.value as OfficialEventCacheEntry;
      if (entry.savedAt < cutoff) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}
