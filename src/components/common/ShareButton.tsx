"use client";

import { useState } from "react";

// 分享按钮：优先用系统分享面板（navigator.share，手机可直接分享到 LINE/X 等）；
// 不支持时弹出回退菜单（X / LINE / Facebook / 复制链接）。
export function ShareButton({ title, url, className }: { title: string; url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  async function onClick() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text: title, url }); return; } catch { /* 取消或失败 → 回退菜单 */ }
    }
    setOpen((v) => !v);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 忽略 */ }
  }

  const links = [
    { label: "X（Twitter）", href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}` },
    { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];

  return (
    <div className="relative">
      <button type="button" onClick={onClick} className={className} aria-label="分享">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
        分享
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="关闭" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 z-20 w-40 rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden py-1">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">{l.label}</a>
            ))}
            <button type="button" onClick={copy} className="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">{copied ? "已复制链接 ✓" : "复制链接"}</button>
          </div>
        </>
      )}
    </div>
  );
}
