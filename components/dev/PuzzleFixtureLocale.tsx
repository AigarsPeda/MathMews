import { LocaleContext } from '@/contexts/LocaleProvider';
import i18n from '@/i18n';
import type { AppLocale } from '@/types/locale';
import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

export const fixtureLocale = (value?: string): AppLocale => value === 'ru' || value === 'lv' ? value : 'en';

export function PuzzleFixtureLocale({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const [language] = useState(() => i18n.cloneInstance({ lng: locale, initAsync: false }));
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async () => {} }}>
    {children}
  </LocaleContext.Provider></I18nextProvider>;
}
