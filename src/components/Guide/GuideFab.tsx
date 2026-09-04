"use client";

import { IconSparkles } from "@/components/icons";
import { MascotNavIcon, useMascotIdentity } from "@/components/Mascot/Mascot";
import { useGuide } from "./GuideContext";

/**
 * Signature: `function GuideFab(): React.JSX.Element`
 * Purpose: Opens the AI guide with the selected character, retaining a compact fallback in no-IP mode.
 */
export function GuideFab() {
  const identity = useMascotIdentity();
  const { openGuide } = useGuide();
  return (
    <button
      type="button"
      onClick={() => openGuide()}
      aria-label="AI 导游"
      className="absolute top-40 right-3 z-20 h-10 px-3 rounded-full shadow-md flex items-center gap-1.5 text-sm font-medium bg-violet-600 text-white active:scale-95 transition"
    >
      {identity === "none" ? <IconSparkles className="w-5 h-5" /> : <MascotNavIcon identity={identity} role="discover" className="h-9 w-9" />}
      AI 导游
    </button>
  );
}
