import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import lv from '@/locales/lv.json';
import { visualHelpEn } from '@/locales/visual-help/en';
import { visualHelpLv } from '@/locales/visual-help/lv';
import { isAppLocale, type AppLocale } from '@/types/locale';

export function getDeviceLocale(): AppLocale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return isAppLocale(code) ? code : 'en';
}

const resources = {
  en: { translation: { ...en, visualHelp: visualHelpEn } },
  lv: { translation: { ...lv, visualHelp: visualHelpLv } },
};

// Fast Refresh reuses the instance. Merge newly authored keys without resetting
// the player's selected language or leaving the old resource store in place.
if (i18n.isInitialized) {
  for (const [locale, resource] of Object.entries(resources)) {
    i18n.addResourceBundle(locale, 'translation', resource.translation, true, true);
  }
} else {
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    resources,
    lng: getDeviceLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
    react: { bindI18nStore: 'added removed' },
  });
}

export default i18n;
