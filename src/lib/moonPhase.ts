export const MOON_PHASES = [
  { key: "new-moon", label: "新月", asset: "/brand/moon-logos/01-new-moon.png" },
  { key: "waxing-crescent", label: "残月（上弦前）", asset: "/brand/moon-logos/02-waxing-crescent.png" },
  { key: "first-quarter", label: "半月（上弦）", asset: "/brand/moon-logos/03-first-quarter.png" },
  { key: "full-moon", label: "满月", asset: "/brand/moon-logos/04-full-moon.png" },
  { key: "last-quarter", label: "半月（下弦）", asset: "/brand/moon-logos/05-last-quarter.png" },
  { key: "waning-crescent", label: "残月（下弦后）", asset: "/brand/moon-logos/06-waning-crescent.png" },
] as const;

export type MoonPhase = (typeof MOON_PHASES)[number];

const DAY_MS = 86_400_000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

/**
 * Signature: `function getMoonPhase(date?: Date): MoonPhase`
 * Purpose: Maps an instant to the closest of the six supplied lunar-logo states using the mean synodic cycle.
 */
export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const elapsedDays = (date.getTime() - REFERENCE_NEW_MOON_MS) / DAY_MS;
  const cycleDay = ((elapsedDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const phase = cycleDay / SYNODIC_MONTH_DAYS;

  if (phase < 0.0625 || phase >= 0.9375) return MOON_PHASES[0];
  if (phase < 0.1875) return MOON_PHASES[1];
  if (phase < 0.375) return MOON_PHASES[2];
  if (phase < 0.625) return MOON_PHASES[3];
  if (phase < 0.8125) return MOON_PHASES[4];
  return MOON_PHASES[5];
}
