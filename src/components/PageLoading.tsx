// 页面加载占位：用分类色小圆点做波浪跳动 + 文案，比单调转圈更有趣、且呼应活动主题。
const DOTS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed"]; // 展览/市集/Live/祭典/讲座

export function PageLoading({ text = "正在加载…" }: { text?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="flex items-end gap-1.5">
        {DOTS.map((c, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full animate-bounce"
            style={{ backgroundColor: c, animationDelay: `${i * 0.12}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
      <p className="text-xs text-neutral-400">{text}</p>
    </div>
  );
}
