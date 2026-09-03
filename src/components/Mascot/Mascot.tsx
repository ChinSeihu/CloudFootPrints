"use client";

import { useSyncExternalStore } from "react";

export type MascotVariant = "standard" | "feminine";
export type MascotCharacter = "kumoashi" | "michiru" | "footprint";
export type MascotNavRole = "map" | "calendar" | "discover" | "profile";

const STORAGE_KEY = "tem_mascot_variant";
const CHANGE_EVENT = "tem:mascot-variant";

/**
 * Signature: `function getMascotVariantSnapshot(): MascotVariant`
 * Purpose: Read the current mascot presentation preference from browser-local storage.
 */
function getMascotVariantSnapshot(): MascotVariant {
  if (typeof window === "undefined") return "standard";
  return window.localStorage.getItem(STORAGE_KEY) === "feminine" ? "feminine" : "standard";
}

/**
 * Signature: `function subscribeMascotVariant(onStoreChange: () => void): () => void`
 * Purpose: Keep every mounted mascot synchronized when its local presentation preference changes.
 */
function subscribeMascotVariant(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/**
 * Signature: `function useMascotVariant(): MascotVariant`
 * Purpose: Expose the selected mascot presentation with hydration-safe reactive updates.
 */
export function useMascotVariant(): MascotVariant {
  return useSyncExternalStore(subscribeMascotVariant, getMascotVariantSnapshot, () => "standard");
}

/**
 * Signature: `function setMascotVariant(variant: MascotVariant): void`
 * Purpose: Persist and broadcast the user's standard or feminine mascot preference.
 */
export function setMascotVariant(variant: MascotVariant): void {
  window.localStorage.setItem(STORAGE_KEY, variant);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const NAV_ROLE_INDEX: Record<MascotNavRole, number> = {
  map: 0,
  calendar: 1,
  discover: 2,
  profile: 3,
};

/**
 * Signature: `function MascotNavIcon({ role, variant, className, title }: MascotNavIconProps): React.JSX.Element`
 * Purpose: Render one full-quality 3D IP pose from the standard or feminine navigation sprite strip.
 */
export function MascotNavIcon({
  role,
  variant,
  className = "h-11 w-8",
  title,
}: {
  role: MascotNavRole;
  variant: MascotVariant;
  className?: string;
  title?: string;
}) {
  const index = NAV_ROLE_INDEX[role];
  return (
    <span
      className={`block shrink-0 bg-no-repeat ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        backgroundImage: `url(/brand/mascots/nav-${variant}.png)`,
        backgroundSize: "400% 100%",
        backgroundPosition: `${(index / 3) * 100}% center`,
      }}
    />
  );
}

/**
 * Signature: `function Mascot({ character, variant, className, title }: MascotProps): React.JSX.Element`
 * Purpose: Render a compact, high-contrast Kumoashi, Michiru, or shared footprint mark for product UI.
 */
export function Mascot({
  character,
  variant,
  className = "h-8 w-8",
  title,
}: {
  character: MascotCharacter;
  variant: MascotVariant;
  className?: string;
  title?: string;
}) {
  const feminine = variant === "feminine";
  const outline = feminine ? "#76509A" : "#334A78";
  const primary = feminine ? "#F272A7" : "#6478D8";
  const secondary = feminine ? "#D9A4F4" : "#72CFC4";
  const accent = feminine ? "#E94D86" : "#FF806D";
  const skin = feminine ? "#FFF5FA" : "#F7FBFF";

  if (character === "footprint") {
    return (
      <svg viewBox="0 0 32 32" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <ellipse cx="16" cy="20" rx="6.2" ry="8" fill={primary} stroke={outline} strokeWidth="1.8" transform="rotate(-18 16 20)" />
        <circle cx="9" cy="10" r="2.6" fill={secondary} stroke={outline} strokeWidth="1.4" />
        <circle cx="14.5" cy="7.4" r="2.7" fill={primary} stroke={outline} strokeWidth="1.4" />
        <circle cx="20.5" cy="8" r="2.5" fill={accent} stroke={outline} strokeWidth="1.4" />
        <circle cx="25" cy="11.5" r="2.2" fill={secondary} stroke={outline} strokeWidth="1.4" />
        <path d="M13.5 20.2c1.3-2 3.7-2 5 0 1.1 1.8-.5 3.8-2.5 5.1-2-1.3-3.6-3.3-2.5-5.1Z" fill={skin} />
      </svg>
    );
  }

  if (character === "kumoashi") {
    return (
      <svg viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <path d="M8.5 25.5c-4.7 0-6.1-6.7-1.7-8.6-.4-5.1 5.8-8.2 9.6-4.8 2.7-4.3 9.6-2.7 10 2.5 5.8-.5 8.2 7.3 3.2 10.4-3.7 2.4-16.5 2-21.1.5Z" fill={skin} stroke={outline} strokeWidth="2" strokeLinejoin="round" />
        <path d="M10.2 26.1c3.4 5.8 16.2 6.2 20-.9-5.5 1-14.5 1.1-20 .9Z" fill={secondary} stroke={outline} strokeWidth="1.7" />
        <path d="M13 27.4c1.9 4.2 9.8 6.1 14.1.4-4.6.7-9.6.6-14.1-.4Z" fill={primary} opacity=".92" />
        <circle cx="15" cy="19.2" r="1.45" fill={outline} /><circle cx="24.7" cy="19.2" r="1.45" fill={outline} />
        <path d="M18 22.2c1.2 1 2.6 1 3.8 0" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M29.5 9.8c1.4-2.4 5-1.1 4.5 1.6-.3 1.7-2.1 2.7-4.3 4.1-1.2-2.3-1.2-4.1-.2-5.7Z" fill={accent} stroke={outline} strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M20 3.5c8 0 14.1 6.1 14.1 13.7 0 9.3-9.1 15.2-14.1 19.2C15 32.4 5.9 26.5 5.9 17.2 5.9 9.6 12 3.5 20 3.5Z" fill={primary} stroke={outline} strokeWidth="2" />
      <path d="M11.2 17.2c0-5 3.9-8.8 8.8-8.8s8.8 3.8 8.8 8.8c0 4.6-3.9 8.1-8.8 8.1s-8.8-3.5-8.8-8.1Z" fill={skin} stroke={outline} strokeWidth="1.6" />
      <path d="M12 10.7c2.4-3.3 5.2-4.8 8-4.8 3.2 0 6.1 1.6 8.3 5.1-4.8-2-11.6-2.2-16.3-.3Z" fill={secondary} />
      <circle cx="16.6" cy="17" r="1.35" fill={outline} /><circle cx="23.4" cy="17" r="1.35" fill={outline} />
      <path d="M18.1 20.5c1.2.9 2.6.9 3.8 0" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28.5" cy="28" r="4.3" fill={secondary} stroke={outline} strokeWidth="1.5" />
      <path d="m28.5 25.4 1 2-1 3.2-1-3.2Z" fill={accent} />
    </svg>
  );
}
