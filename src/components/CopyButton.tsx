"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@/components/icons";
import { copyToClipboard } from "@/lib/clipboard";
import { useLanguage } from "@/components/I18n/LanguageProvider";

// 通用复制按钮：点一下把 text 写入剪贴板，短暂切换成对勾反馈。
export function CopyButton({
  text,
  className = "",
  label,
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t("common.copy");
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
      aria-label={resolvedLabel}
      title={copied ? t("common.copied") : resolvedLabel}
      className={`inline-flex items-center justify-center shrink-0 transition-colors ${
        copied ? "text-green-600" : "text-neutral-400 hover:text-blue-600"
      } ${className}`}
    >
      {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
    </button>
  );
}
