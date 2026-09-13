"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { enMessages } from "@/i18n/locales/en";
import { jaMessages } from "@/i18n/locales/ja";
import { zhMessages } from "@/i18n/locales/zh";
import { LANGUAGE_COOKIE_KEY, LANGUAGE_STORAGE_KEY, type AppLanguage, type TranslationKey, type TranslationMessages } from "@/i18n/config";

const messages: Record<AppLanguage, TranslationMessages> = { zh: zhMessages, ja: jaMessages, en: enMessages };

export type { AppLanguage, TranslationKey } from "@/i18n/config";
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey, values?: Record<string, string | number>) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Signature: `function LanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage: AppLanguage }): React.JSX.Element`
 * Purpose: Supplies localized UI strings and persists an explicit device language selection.
 */
export function LanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage: AppLanguage }) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      setLanguageState(nextLanguage);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
    },
    t(key, values) {
      const message = messages[language][key];
      if (!values) return message;
      return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), message);
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Signature: `function useLanguage(): LanguageContextValue`
 * Purpose: Reads and updates the active application language from client components.
 */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
