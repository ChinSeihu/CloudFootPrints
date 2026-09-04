"use client";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

const values = new Map<string, unknown>();
/**
 * Signature: `function useBrowseState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>]`
 * Purpose: Retains tab-local browsing state across route unmounts without storing it on the server or disk.
 */
export function useBrowseState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, update] = useState<T>(() => values.has(key) ? values.get(key) as T : typeof initial === "function" ? (initial as () => T)() : initial);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    update(previous => {
      const resolved = typeof next === "function" ? (next as (value: T) => T)(previous) : next;
      values.set(key, resolved);
      return resolved;
    });
  }, [key]);
  return [value, setValue];
}
