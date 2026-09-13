import type { TranslationMessages } from "@/i18n/config";

export const jaMessages = {
  "nav.primary": "メインナビゲーション",
  "nav.map": "マップ",
  "nav.calendar": "カレンダー",
  "nav.explore": "見つける",
  "nav.me": "マイページ",
  "profile.openMenu": "プロフィールメニューを開く",
  "profile.edit": "プロフィールを編集",
  "profile.logout": "ログアウト",
  "settings.language": "言語",
  "settings.languageHint": "すぐに反映 · この端末のみ",
  "settings.chinese": "中文",
  "settings.japanese": "日本語",
  "settings.english": "English",
  "translate.action": "翻訳",
  "translate.loading": "翻訳中…",
  "translate.original": "原文を見る",
  "translate.retry": "翻訳できませんでした。再試行",
} as const satisfies TranslationMessages;
