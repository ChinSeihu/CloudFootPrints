import { zhMessages } from "@/i18n/locales/zh";

export const SUPPORTED_LANGUAGES = ["zh", "ja", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type TranslationKey = keyof typeof zhMessages;
export type TranslationMessages = Record<TranslationKey, string>;

export const LANGUAGE_COOKIE_KEY = "tem_language";
export const LANGUAGE_STORAGE_KEY = "tem_language";
export const DEFAULT_LANGUAGE: AppLanguage = "en";

/**
 * Signature: `function isAppLanguage(value: unknown): value is AppLanguage`
 * Purpose: Validates persisted and request-derived locale values against the supported language list.
 */
export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGES.some((language) => language === value);
}
