"use client";

import { useEffect, useState } from "react";
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
  // 乐观高亮：点击后立即高亮目标 tab（不等页面加载完），导航完成再由 pathname 接管。
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [pathname]);
  const activeHref = pending ?? pathname;

  return (
    <nav className="shrink-0 h-16 border-t border-black/10 bg-white/95 backdrop-blur grid grid-cols-4">
      {TABS.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setPending(tab.href)}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition-all duration-150 ${
              active ? "text-blue-600 font-medium scale-110" : "text-neutral-500 scale-100"
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
