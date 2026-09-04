"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
const positions = new Map<string, number>();
/**
 * Signature: `function BrowseScroll({ storageKey, children }: { storageKey: string; children: ReactNode }): React.JSX.Element`
 * Purpose: Restores the nested page scroller after content mounts and remembers its position while browsing.
 */
export function BrowseScroll({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const target = positions.get(storageKey) ?? 0;
    let restoring = true;
    const restore = () => {
      node.scrollTop = target;
      if (Math.abs(node.scrollTop - target) < 2) { restoring = false; observer.disconnect(); }
    };
    const observer = new ResizeObserver(restore);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    restore();
    const cancel = () => { restoring = false; observer.disconnect(); };
    const save = () => { if (!restoring) positions.set(storageKey, node.scrollTop); };
    node.addEventListener("scroll", save, { passive: true });
    node.addEventListener("pointerdown", cancel, { passive: true });
    node.addEventListener("wheel", cancel, { passive: true });
    node.addEventListener("keydown", cancel);
    return () => {
      observer.disconnect();
      if (!restoring) positions.set(storageKey, node.scrollTop);
      node.removeEventListener("scroll", save);
      node.removeEventListener("pointerdown", cancel);
      node.removeEventListener("wheel", cancel);
      node.removeEventListener("keydown", cancel);
    };
  }, [storageKey]);
  return <div ref={ref} className="h-full overflow-y-auto"><div>{children}</div></div>;
}
