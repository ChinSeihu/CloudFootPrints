import type { TranslationMessages } from "@/i18n/config";

export const enMessages = {
  "nav.primary": "Primary navigation",
  "nav.map": "Map",
  "nav.calendar": "Calendar",
  "nav.explore": "Explore",
  "nav.me": "Me",
  "profile.openMenu": "Open profile menu",
  "profile.edit": "Edit profile",
  "profile.logout": "Log out",
  "settings.language": "Language",
  "settings.languageHint": "Applies now · This device only",
  "settings.chinese": "中文",
  "settings.japanese": "日本語",
  "settings.english": "English",
  "translate.action": "Translate",
  "translate.loading": "Translating…",
  "translate.original": "View original",
  "translate.retry": "Translation failed. Retry",
} as const satisfies TranslationMessages;
