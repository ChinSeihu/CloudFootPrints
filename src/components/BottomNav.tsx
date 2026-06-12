"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMap, IconCalendar, IconCompass, IconUser } from "@/components/icons";

// 底部四个 tab：地图 / 日历 / 推荐 / 个人。
// "打卡/发帖"是动作（地图上的 FAB），不在这里——见 components/Map/ActionFab。
const TABS = [
  { href: "/", label: "地图", Icon: IconMap },
  { href: "/calendar", label: "日历", Icon: IconCalendar },
  { href: "/recommend", label: "推荐", Icon: IconCompass },
  { href: "/me", label: "个人", Icon: IconUser },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="shrink-0 h-16 border-t border-black/10 bg-white/95 backdrop-blur grid grid-cols-4">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
              active ? "text-blue-600 font-medium" : "text-neutral-500"
            }`}
          >
            <tab.Icon className="w-5 h-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
