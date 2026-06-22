// 官方抓取活动 vs 用户发帖 的视觉区分：小徽标 + 来源筛选。
// 约定：sourceType === "USER" 为个人发帖，其余（walkerplus/jalan/connpass…）为官方。
import type { EventDTO } from "@/lib/types";

export type SourceSel = "ALL" | "OFFICIAL" | "USER";

export function isUserPost(sourceType: string): boolean {
  return sourceType === "USER";
}

export function matchSource(sel: SourceSel, sourceType: string): boolean {
  if (sel === "ALL") return true;
  if (sel === "USER") return isUserPost(sourceType);
  return !isUserPost(sourceType);
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4Z" />
    </svg>
  );
}
function IconBadgeCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 12 2 2 4-4" />
      <path d="M12 3l2.3 1.7 2.8-.2 1 2.7 2.4 1.5-.8 2.7.8 2.7-2.4 1.5-1 2.7-2.8-.2L12 21l-2.3-1.7-2.8.2-1-2.7L3.5 15.5l.8-2.7-.8-2.7 2.4-1.5 1-2.7 2.8.2z" />
    </svg>
  );
}

// 卡片/弹窗上的来源徽标。
export function SourceBadge({ sourceType, className = "" }: { sourceType: string; className?: string }) {
  const user = isUserPost(sourceType);
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium leading-none ${
        user ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
      } ${className}`}
    >
      {user ? <IconPerson className="w-2.5 h-2.5" /> : <IconBadgeCheck className="w-2.5 h-2.5" />}
      {user ? "个人" : "官方"}
    </span>
  );
}

// 来源筛选：全部 / 官方 / 个人 三选一。
export function SourceFilter({ value, onChange }: { value: SourceSel; onChange: (v: SourceSel) => void }) {
  const opts: { k: SourceSel; label: string; active: string }[] = [
    { k: "ALL", label: "全部来源", active: "bg-neutral-700 text-white" },
    { k: "OFFICIAL", label: "官方", active: "bg-sky-600 text-white" },
    { k: "USER", label: "个人", active: "bg-amber-500 text-white" },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-neutral-100">
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
            value === o.k ? o.active + " shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// 便捷：直接对 EventDTO 数组按来源过滤。
export function filterBySource<T extends Pick<EventDTO, "sourceType">>(list: T[], sel: SourceSel): T[] {
  return sel === "ALL" ? list : list.filter((e) => matchSource(sel, e.sourceType));
}
