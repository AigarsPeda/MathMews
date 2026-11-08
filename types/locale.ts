export const APP_LOCALES = ["en", "lv", "ru"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "@mathmews/locale";

export function isAppLocale(value: string): value is AppLocale {
  return APP_LOCALES.some(locale => locale === value);
}
