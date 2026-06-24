import i18n, { getDeviceLocale } from "@/i18n";
import type { AppLocale } from "@/types/locale";
import { loadSavedLocale, saveLocale } from "@/utils/locale-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocaleContextValue = {
  locale: AppLocale;
  isReady: boolean;
  setLocale: (locale: AppLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(getDeviceLocale());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    loadSavedLocale()
      .then((saved) => {
        if (!active) return;
        const next = saved ?? getDeviceLocale();
        setLocaleState(next);
        void i18n.changeLanguage(next);
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next);
    await i18n.changeLanguage(next);
    await saveLocale(next);
  }, []);

  const value = useMemo(
    () => ({ locale, isReady, setLocale }),
    [isReady, locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
