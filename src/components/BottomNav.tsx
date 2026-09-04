"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MascotNavIcon, useMascotIdentity, type MascotNavRole } from "@/components/Mascot/Mascot";

const TABS: ReadonlyArray<{ href: string; label: string; role: MascotNavRole }> = [
  { href: "/", label: "地图", role: "map" },
  { href: "/calendar", label: "日历", role: "calendar" },
  { href: "/recommend", label: "探索", role: "discover" },
  { href: "/me", label: "我的", role: "profile" },
] as const;

/**
 * Signature: `function BottomNav(): React.JSX.Element`
 * Purpose: Renders primary navigation with a shared raised active surface and reduced-motion-aware character feedback.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mascotIdentity = useMascotIdentity();
  const [pending, setPending] = useState<string | null>(null);

  const activeHref = pending && pending !== pathname ? pending : pathname;

  return (
    <nav aria-label="主要导航" className="grid h-[4.5rem] shrink-0 grid-cols-4 items-center gap-1 border-t border-black/10 bg-white/95 px-2 backdrop-blur">
      {TABS.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setPending(tab.href)}
            onPointerEnter={() => router.prefetch(tab.href)}
            onTouchStart={() => router.prefetch(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`group mx-auto flex h-[68px] w-full max-w-24 flex-col items-center justify-center gap-0 rounded-[22px] text-xs motion-safe:transition-[transform,box-shadow,color,background-color] motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
              active ? "bg-gradient-to-b from-violet-50/50 to-violet-100/80 font-semibold text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_10px_-4px_rgba(109,40,217,0.28)]" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            }`}
          >
            <span className={`grid h-[50px] w-14 shrink-0 place-items-center motion-safe:transition-[transform,filter] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-95 ${active ? "drop-shadow-[0_2px_2px_rgba(76,29,149,0.2)] motion-safe:-translate-y-0.5 motion-safe:scale-[1.03]" : "motion-safe:group-hover:-translate-y-0.5"}`}>
              <MascotNavIcon role={tab.role} identity={mascotIdentity} className="h-[52px] w-[52px]" />
            </span>
            <span className="relative leading-4">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
