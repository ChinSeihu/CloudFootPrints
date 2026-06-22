"use client";

import { useEffect, useState } from "react";

// 应用内确认弹窗：替代 window.confirm（部分移动端 webview 的 confirm 不可靠，
// 甚至点「取消」也返回 true 导致误删）。受控显示，确认/取消各回调。
// onConfirm 支持返回 Promise：执行期间确认按钮显示加载态并禁用按钮，给用户明确反馈。
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
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // 弹窗关闭后复位忙碌态（下次打开是干净状态）
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      // 成功后通常由父组件把 open 置 false（→ effect 复位 busy）
    } catch {
      setBusy(false); // 失败则保持弹窗，允许重试/取消
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6" onClick={busy ? undefined : onCancel}>
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
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200/70 transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-80 ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
            )}
            {busy ? "处理中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
