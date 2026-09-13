"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LoadingScene, type LoadingSceneKind } from "./Mascot/LoadingScene";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";

const DOTS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed"]; // 展览/市集/Live/祭典/讲座
const SPLASH_LOGO = "/brand/splash-logo-02-wordmark.png";

/**
 * Signature: `function PageLoading({ text, messageKey, scene, variant }: { text?: string; messageKey?: TranslationKey; scene?: LoadingSceneKind; variant?: "default" | "splash" }): React.JSX.Element`
 * Purpose: Delays route feedback to avoid flashes, with the fixed high-resolution 02 brand mark, embedded wordmark, and preserved tagline for the initial splash.
 */
export function PageLoading({ text, messageKey, scene, variant = "default" }: { text?: string; messageKey?: TranslationKey; scene?: LoadingSceneKind; variant?: "default" | "splash" }) {
  const { t } = useLanguage();
  const resolvedText = messageKey ? t(messageKey) : text ?? t("loading.default");
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  if (variant === "splash") {
    return (
      <div className="fixed inset-0 z-[2000] grid place-items-center overflow-hidden bg-white text-[#282447]" role="status" aria-busy="true" data-splash-logo="02">
        <div className={`flex flex-col items-center transition-all duration-700 ease-out ${visible ? "scale-100 opacity-100" : "scale-[.96] opacity-0"}`}>
          <Image src={SPLASH_LOGO} alt={t("brand.alt")} width={1024} height={1024} sizes="(min-width: 768px) 288px, 224px" priority unoptimized className="h-56 w-56 md:h-72 md:w-72" />
          <h1 className="sr-only">{t("brand.name")}</h1>
          <p className="mt-1 text-xs tracking-[.28em] text-[#9690aa] md:text-sm">{t("brand.tagline")}</p>
          <div aria-label={resolvedText} className="mt-7 flex items-center gap-2">
            {[0, 1, 2].map((index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#7b6dde] motion-safe:animate-pulse" style={{ animationDelay: `${index * 180}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-64 flex flex-col items-center justify-center gap-3" role="status" aria-busy="true">
      {visible && <>
      {scene ? <LoadingScene scene={scene} /> : <div aria-hidden="true" className="flex items-end gap-1.5">
        {DOTS.map((c, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full motion-safe:animate-bounce"
            style={{ backgroundColor: c, animationDelay: `${i * 0.12}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>}
      <p className="text-sm text-neutral-500">{resolvedText}</p>
      </>}
    </div>
  );
}
