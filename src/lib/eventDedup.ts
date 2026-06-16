// 跨源活动去重：同一活动常被多个源（walkerplus / jalan）以不同标题收录
// （如「山王祭」与「日枝神社 山王祭」）。判同规则（保守、低误并）：
//   同一开始日期（东京时区） 且 标题规范化后相等或互为子串（核心长度≥3）。
// 无开始时间的活动无法可靠判同，一律视为不重复（保留）。

export type DedupEvent = { title: string; startTime: Date | string | null };

// 规范化标题：NFKC 全角→半角、小写、去空白与常见标点/括号。
export function normTitle(t: string): string {
  return (t || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[【】[\]()（）「」『』〜~・,，.。!！?？\-—_:：/／|｜]/g, "");
}

// 东京时区的「年-月-日」键；无时间返回 ""。
export function tokyoDayKey(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
}

export function isSameEvent(a: DedupEvent, b: DedupEvent): boolean {
  const da = tokyoDayKey(a.startTime);
  const db = tokyoDayKey(b.startTime);
  if (!da || !db || da !== db) return false; // 必须同一天
  const na = normTitle(a.title);
  const nb = normTitle(b.title);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  return false;
}

// 对一批活动去重；keepBetter(a,b) 返回应保留的那条（默认保留先出现的 a）。
export function dedupeEvents<T extends DedupEvent>(list: T[], keepBetter?: (a: T, b: T) => T): T[] {
  const kept: T[] = [];
  for (const e of list) {
    const idx = kept.findIndex((k) => isSameEvent(k, e));
    if (idx === -1) {
      kept.push(e);
    } else if (keepBetter) {
      kept[idx] = keepBetter(kept[idx], e);
    }
  }
  return kept;
}
