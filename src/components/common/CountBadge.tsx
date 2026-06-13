// 小圆 / 胶囊计数徽章：单位数为圆形，多位数自动撑成胶囊。
// 用于 tab 旁的数量标识，替代裸数字。
export function CountBadge({
  count,
  active = false,
  tone = "blue",
}: {
  count: number;
  active?: boolean;
  tone?: "blue" | "amber";
}) {
  const activeCls =
    tone === "amber" ? "bg-amber-500 text-white" : "bg-blue-600 text-white";
  const idleCls = "bg-neutral-200/80 text-neutral-500";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-none tabular-nums transition-colors ${
        active ? activeCls : idleCls
      }`}
    >
      {count}
    </span>
  );
}
