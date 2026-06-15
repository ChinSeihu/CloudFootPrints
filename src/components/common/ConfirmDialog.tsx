"use client";

// 应用内确认弹窗：替代 window.confirm（部分移动端 webview 的 confirm 不可靠，
// 甚至点「取消」也返回 true 导致误删）。受控显示，确认/取消各回调。
export function ConfirmDialog({
  open,
  message,
  title = "确认",
  confirmText = "删除",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xs rounded-2xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-neutral-900 mb-1">{title}</div>
        <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200/70 transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
