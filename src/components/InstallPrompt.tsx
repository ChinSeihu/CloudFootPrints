"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "cloudfootprints_install_prompt_v1";
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Signature: `function isStandalone(): boolean`
 * Purpose: Detects installed display modes so app users never see a web-install reminder.
 */
function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

/**
 * Signature: `function rememberDismissal(): void`
 * Purpose: Suppresses repeated install education for thirty days after an explicit dismissal.
 */
function rememberDismissal(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* The prompt can still close when storage is unavailable. */ }
}

/**
 * Signature: `function InstallPrompt(): React.JSX.Element | null`
 * Purpose: Educates browser users about the installable desktop app and invokes the native installer when available.
 */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    if (isStandalone()) return;
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMIND_AFTER_MS) return;
    } catch { /* Continue with a session-only reminder. */ }
    const onInstallReady = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { rememberDismissal(); setVisible(false); };
    window.addEventListener("beforeinstallprompt", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => setVisible(true), 6000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Signature: `async function install(): Promise<void>`
   * Purpose: Opens the browser installer or reveals concise manual instructions when no native prompt is exposed.
   */
  async function install() {
    if (!installEvent) { setShowHelp(true); return; }
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      rememberDismissal();
      setVisible(false);
    } catch {
      setShowHelp(true);
    } finally {
      setInstallEvent(null);
    }
  }

  if (!visible) return null;
  const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return (
    <aside role="dialog" aria-label="安装云迹东京桌面应用" className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[45] mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[0_18px_52px_rgba(15,23,42,0.24)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local install icon is already optimized at 192px. */}
        <img src="/brand-icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl shadow-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">云迹东京也可以安装到桌面</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">独立窗口打开，像普通应用一样从桌面或程序坞进入。</p>
        </div>
        <button type="button" onClick={() => { rememberDismissal(); setVisible(false); }} aria-label="关闭安装提示" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-slate-400 hover:bg-slate-100">×</button>
      </div>
      {showHelp && <p role="status" className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">{isApple ? "在 Safari 菜单中选择「文件 → 添加到程序坞」；iPhone/iPad 请点分享后选择「添加到主屏幕」。" : "请打开浏览器菜单，选择「安装云迹东京」或「将页面安装为应用」。"}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => { rememberDismissal(); setVisible(false); }} className="min-h-10 rounded-full px-3 text-xs font-semibold text-slate-500">以后再说</button>
        <button type="button" onClick={() => void install()} className="min-h-10 rounded-full bg-gradient-to-r from-violet-600 to-sky-500 px-4 text-xs font-bold text-white shadow-sm">{installEvent ? "安装到桌面" : "查看安装方法"}</button>
      </div>
    </aside>
  );
}
