"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconCompass, IconMap, IconUser } from "@/components/icons";

const TABS = [
  { href: "/", label: "地图", Icon: IconMap },
  { href: "/calendar", label: "日历", Icon: IconCalendar },
  { href: "/recommend", label: "探索", Icon: IconCompass },
  { href: "/me", label: "我的", Icon: IconUser },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  const activeHref = pending ?? pathname;

  return (
    <nav className="grid h-16 shrink-0 grid-cols-4 border-t border-black/10 bg-white/95 backdrop-blur">
      {TABS.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setPending(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs transition ${
              active ? "font-semibold text-blue-600" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full transition ${active ? "bg-blue-600 text-white shadow-sm" : ""}`}>
              <tab.Icon className="h-5 w-5" />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
