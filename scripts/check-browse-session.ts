import assert from "node:assert/strict";
import { readBrowseSession, writeBrowseSession } from "../src/lib/browseSession";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
const snapshot = { tab: "OFFICIAL", filters: new Set(["LIVE", "EXHIBITION"]), range: { from: "2026-09-07", to: null } };
writeBrowseSession(storage, "recommend:guest:ui", snapshot);
const restored = readBrowseSession<typeof snapshot>(storage, "recommend:guest:ui");
assert.equal(restored?.tab, snapshot.tab);
assert.deepEqual(restored?.filters, snapshot.filters, "Set filters should survive a session round trip");
assert.deepEqual(restored?.range, snapshot.range);

storage.setItem("tem:browse:v1:broken", "not json");
assert.equal(readBrowseSession(storage, "broken"), undefined, "malformed state should be ignored safely");
storage.setItem("tem:browse:v1:stale", JSON.stringify({ version: 0, value: "old" }));
assert.equal(readBrowseSession(storage, "stale"), undefined, "stale schemas should not be restored");

console.log("browse session checks passed");
