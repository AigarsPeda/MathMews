import type { AppLocale } from "@/types/locale";

const LOCALE_TAGS: Record<AppLocale, string> = {
  en: "en-US",
  lv: "lv-LV",
};

export function formatGameStartedDate(
  timestampMs: number,
  locale: AppLocale,
): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "";

  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestampMs));
}
