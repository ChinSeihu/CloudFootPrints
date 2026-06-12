"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@/components/icons";
import { copyToClipboard } from "@/lib/clipboard";

// 通用复制按钮：点一下把 text 写入剪贴板，短暂切换成对勾反馈。
export function CopyButton({
  text,
  className = "",
  label = "复制",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={copied ? "已复制" : label}
      className={`inline-flex items-center justify-center shrink-0 transition-colors ${
        copied ? "text-green-600" : "text-neutral-400 hover:text-blue-600"
      } ${className}`}
    >
      {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
    </button>
  );
}
