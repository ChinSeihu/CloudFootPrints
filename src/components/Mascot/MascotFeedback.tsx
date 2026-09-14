"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MascotMotion, type MascotMotionKind } from "./MascotMotion";
import { LoadingScene } from "./LoadingScene";
import { useLanguage } from "@/components/I18n/LanguageProvider";

/**
 * Signature: `function MascotAnimation({ animated, kind, className }: { animated?: boolean; kind?: MascotMotionKind; className?: string }): React.JSX.Element | null`
 * Purpose: Preserves existing feedback sizes while using stable continuous motion instead of the retired eight-frame atlas.
 */
export function MascotAnimation({ animated = false, kind = "idle", className = "h-28 w-28" }: { animated?: boolean; kind?: MascotMotionKind; className?: string }) {
  return <MascotMotion animated={animated} kind={kind} className={className} />;
}

/**
 * Signature: `function MascotFeedback({ children, loading }: { children: ReactNode; loading?: boolean }): React.JSX.Element`
 * Purpose: Adds optional quiet character companionship without replacing feedback text or actions.
 */
export function MascotFeedback({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return <div className="flex flex-col items-center gap-2 py-4 text-center" role={loading ? "status" : undefined}>
    {loading ? <LoadingScene scene="discover" /> : <MascotAnimation />}
    <div className="text-sm text-neutral-500">{children}</div>
  </div>;
}

/**
 * Signature: `function NavigationFeedback(): React.JSX.Element | null`
 * Purpose: Delays route-loading feedback to avoid flashes during fast navigation.
 */
export function NavigationFeedback() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="grid min-h-64 flex-1 place-items-center"><MascotFeedback loading>{t("loading.openingPage")}</MascotFeedback></div>;
}
