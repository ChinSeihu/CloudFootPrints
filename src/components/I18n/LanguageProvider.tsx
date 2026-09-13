"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "zh" | "ja" | "en";

const messages = {
  zh: { "nav.primary": "主要导航", "nav.map": "地图", "nav.calendar": "日历", "nav.explore": "探索", "nav.me": "我的", "profile.openMenu": "打开资料菜单", "profile.edit": "编辑资料", "profile.logout": "登出", "settings.language": "语言", "settings.languageHint": "立即生效 · 仅此设备", "settings.chinese": "中文", "settings.japanese": "日本語", "settings.english": "English", "translate.action": "翻译", "translate.loading": "翻译中…", "translate.original": "查看原文", "translate.retry": "翻译失败，重试" },
  ja: { "nav.primary": "メインナビゲーション", "nav.map": "マップ", "nav.calendar": "カレンダー", "nav.explore": "見つける", "nav.me": "マイページ", "profile.openMenu": "プロフィールメニューを開く", "profile.edit": "プロフィールを編集", "profile.logout": "ログアウト", "settings.language": "言語", "settings.languageHint": "すぐに反映 · この端末のみ", "settings.chinese": "中文", "settings.japanese": "日本語", "settings.english": "English", "translate.action": "翻訳", "translate.loading": "翻訳中…", "translate.original": "原文を見る", "translate.retry": "翻訳できませんでした。再試行" },
  en: { "nav.primary": "Primary navigation", "nav.map": "Map", "nav.calendar": "Calendar", "nav.explore": "Explore", "nav.me": "Me", "profile.openMenu": "Open profile menu", "profile.edit": "Edit profile", "profile.logout": "Log out", "settings.language": "Language", "settings.languageHint": "Applies now · This device only", "settings.chinese": "中文", "settings.japanese": "日本語", "settings.english": "English", "translate.action": "Translate", "translate.loading": "Translating…", "translate.original": "View original", "translate.retry": "Translation failed. Retry" },
} as const;

export type TranslationKey = keyof typeof messages.zh;
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey) => string };
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
      localStorage.setItem("tem_language", nextLanguage);
      document.cookie = `tem_language=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
    },
    t(key) { return messages[language][key]; },
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
