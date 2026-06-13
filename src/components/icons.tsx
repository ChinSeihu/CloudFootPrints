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

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 3l1.6 4.4L15 9l-4.4 1.6L9 15l-1.6-4.4L3 9l4.4-1.6z" />
      <path d="M18 5l.8 2.2L21 8l-2.2.8L18 11l-.8-2.2L15 8l2.2-.8z" />
    </svg>
  );
}

// ---- 天气图标 ----

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconCloud(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 6.5 19h11Z" />
    </svg>
  );
}

export function IconCloudRain(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 13a5 5 0 0 0 0-9 6 6 0 0 0-11.3 1.7A3.5 3.5 0 0 0 5.5 13H16Z" />
      <path d="M8 17v2M12 18v2M16 17v2" />
    </svg>
  );
}

export function IconCloudSnow(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 13a5 5 0 0 0 0-9 6 6 0 0 0-11.3 1.7A3.5 3.5 0 0 0 5.5 13H16Z" />
      <path d="M8 17h.01M12 18h.01M16 17h.01M8 21h.01M12 22h.01M16 21h.01" />
    </svg>
  );
}

export function IconCloudFog(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 13a5 5 0 0 0 0-9 6 6 0 0 0-11.3 1.7A3.5 3.5 0 0 0 5.5 13H16Z" />
      <path d="M5 17h14M7 21h10" />
    </svg>
  );
}

export function IconCloudLightning(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 12a5 5 0 0 0 0-9 6 6 0 0 0-11.3 1.7A3.5 3.5 0 0 0 5.5 12" />
      <path d="m13 12-3 5h4l-3 5" />
    </svg>
  );
}

// 按天气大类挑图标（kind 来自 services/weather）。
export function WeatherIcon({
  kind,
  ...props
}: IconProps & { kind: "sunny" | "cloudy" | "fog" | "rain" | "snow" | "storm" }) {
  switch (kind) {
    case "sunny": return <IconSun {...props} />;
    case "fog": return <IconCloudFog {...props} />;
    case "rain": return <IconCloudRain {...props} />;
    case "snow": return <IconCloudSnow {...props} />;
    case "storm": return <IconCloudLightning {...props} />;
    default: return <IconCloud {...props} />;
  }
}

// ---- 分类图标 ----
// 与地图 marker 共用同一份 glyph 来源（lib/categoryIcons.ts），保证风格统一。

export function CategoryIcon({
  category,
  ...props
}: IconProps & { category: EventCategory }) {
  return <svg {...base(props)} dangerouslySetInnerHTML={{ __html: CATEGORY_GLYPH[category] }} />;
}
