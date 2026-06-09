import type { SVGProps } from "react";
import type { EventCategory } from "@/lib/categories";
import { CATEGORY_GLYPH } from "@/lib/categoryIcons";

// 扁平线性图标集（Lucide 风格，24x24，stroke=currentColor）。
// 全站统一替代 emoji；颜色随 currentColor，尺寸用 className 控制（如 w-5 h-5）。

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: "1em",
    height: "1em",
    ...props,
  };
}

export function IconMap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 6 3 4v14l6 2 6-2 6 2V6l-6-2-6 2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconStar({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3 2.7 5.5 6 .9-4.35 4.2 1 6L12 16.8 6.65 19.6l1-6L3.3 9.4l6-.9Z" />
    </svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

// ---- 分类图标 ----
// 与地图 marker 共用同一份 glyph 来源（lib/categoryIcons.ts），保证风格统一。

export function CategoryIcon({
  category,
  ...props
}: IconProps & { category: EventCategory }) {
  return <svg {...base(props)} dangerouslySetInnerHTML={{ __html: CATEGORY_GLYPH[category] }} />;
}
