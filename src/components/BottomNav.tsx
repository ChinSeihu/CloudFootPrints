"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MascotNavIcon, useMascotIdentity, type MascotNavRole, type MascotIdentity } from "@/components/Mascot/Mascot";

const TABS: ReadonlyArray<{ href: string; label: string; role: MascotNavRole }> = [
  { href: "/", label: "地图", role: "map" },
  { href: "/calendar", label: "日历", role: "calendar" },
  { href: "/recommend", label: "探索", role: "discover" },
  { href: "/me", label: "我的", role: "profile" },
] as const;

const ACTIVE_COLORS: Record<Exclude<MascotIdentity, "none">, string> = {
  kumoashi: "text-sky-700",
  "kumoashi-sakura": "text-rose-600",
  michiru: "text-teal-700",
  "michiru-lilac": "text-violet-700",
};

/**
 * Signature: `function BottomNav(): React.JSX.Element`
 * Purpose: Renders character-led selection feedback or compact text navigation, retaining accessible active and focus states.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mascotIdentity = useMascotIdentity();
  const textOnly = mascotIdentity === "none";
  const [pending, setPending] = useState<string | null>(null);

  const activeHref = pending && pending !== pathname ? pending : pathname;

  return (
    <nav
      aria-label="主要导航"
      className={`relative z-[50] grid ${textOnly ? "min-h-14" : "min-h-[4.5rem]"} h-auto shrink-0 grid-cols-4 items-center gap-1 border-t border-black/10 bg-white/95 px-2 backdrop-blur`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {TABS.map((tab) => {
        const active = activeHref === tab.href;
        if (textOnly) return (
          <Link key={tab.href} href={tab.href}
            onClick={() => setPending(tab.href)}
            onPointerEnter={() => router.prefetch(tab.href)}
            onTouchStart={() => router.prefetch(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-12 items-center justify-center rounded-lg text-[15px] tracking-wider motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${active ? "font-semibold text-violet-700" : "font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"}`}>
            {tab.label}
            <span aria-hidden="true" className={`absolute bottom-1 h-0.5 w-4 rounded-full bg-violet-500 motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"}`} />
          </Link>
        );
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setPending(tab.href)}
            onPointerEnter={() => router.prefetch(tab.href)}
            onTouchStart={() => router.prefetch(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`group relative isolate mx-auto flex h-[68px] w-full max-w-24 flex-col items-center justify-center gap-0 rounded-2xl text-xs motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
              active ? ACTIVE_COLORS[mascotIdentity] : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span aria-hidden="true" className={`pointer-events-none absolute bottom-[19px] h-2.5 w-10 rounded-[50%] bg-current blur-[3px] motion-safe:transition-[opacity,transform] motion-safe:duration-300 ${active ? "scale-x-100 opacity-20" : "scale-x-50 opacity-0"}`} />
            <span className={`relative grid h-[50px] w-14 shrink-0 place-items-center motion-safe:transition-[transform,filter,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-95 ${active ? "-translate-y-1 scale-110 opacity-100 drop-shadow-[0_3px_2px_rgba(30,41,59,0.12)]" : "opacity-75 saturate-[0.8] group-hover:opacity-100 motion-safe:group-hover:-translate-y-0.5"}`}>
              <MascotNavIcon role={tab.role} identity={mascotIdentity} className="h-[52px] w-[52px]" />
            </span>
            <span className={`relative leading-4 ${active ? "font-bold" : "font-medium"}`}>
              <span aria-hidden="true" className={`absolute -left-2.5 top-1.5 h-1 w-1 rounded-full bg-current motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${active ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
