export const APP_LOCALES = ["en", "lv"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "@mathmews/locale";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  lv: "Latviešu",
};

export function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "lv";
}
