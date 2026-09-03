"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconCalendar, IconCompass, IconMap, IconUser } from "@/components/icons";
import { Mascot, useMascotVariant } from "@/components/Mascot/Mascot";

const TABS = [
  { href: "/", label: "地图", Icon: IconMap },
  { href: "/calendar", label: "日历", Icon: IconCalendar },
  { href: "/recommend", label: "探索", Icon: IconCompass },
  { href: "/me", label: "我的", Icon: IconUser },
] as const;

/**
 * Signature: `function BottomNav(): React.JSX.Element`
 * Purpose: Render the app-wide primary navigation with character-led active states.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mascotVariant = useMascotVariant();
  const [pending, setPending] = useState<string | null>(null);

  const activeHref = pending && pending !== pathname ? pending : pathname;

  return (
    <nav className="grid h-16 shrink-0 grid-cols-4 border-t border-black/10 bg-white/95 backdrop-blur">
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
            className={`flex flex-col items-center justify-center gap-0.5 text-xs transition ${
              active ? "font-semibold text-blue-600" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full transition ${active ? "bg-gradient-to-br from-white to-violet-50 shadow-sm ring-1 ring-violet-100" : ""}`}>
              {active && tab.href === "/" ? (
                <Mascot character="michiru" variant={mascotVariant} className="h-8 w-8" title="路灵 Michiru" />
              ) : active && tab.href === "/recommend" ? (
                <Mascot character="kumoashi" variant={mascotVariant} className="h-8 w-8" title="云足 Kumoashi" />
              ) : (
                <tab.Icon className="h-5 w-5" />
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
