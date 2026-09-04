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
 * Purpose: Render the app-wide primary navigation with character-led active states.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mascotIdentity = useMascotIdentity();
  const [pending, setPending] = useState<string | null>(null);

  const activeHref = pending && pending !== pathname ? pending : pathname;

  return (
    <nav className="grid h-[4.5rem] shrink-0 grid-cols-4 border-t border-black/10 bg-white/95 backdrop-blur">
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
            className={`flex flex-col items-center justify-center gap-0 text-xs transition ${
              active ? "font-semibold text-blue-600" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className={`grid h-[52px] w-14 place-items-center rounded-2xl motion-safe:transition-transform ${active ? "-translate-y-0.5 scale-105 bg-violet-100/70 ring-1 ring-violet-200" : ""}`}>
              <MascotNavIcon role={tab.role} identity={mascotIdentity} className="h-[52px] w-[52px]" />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
