import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as ExpoLocalization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import en from '@/locales/en.json';
import hi from '@/locales/hi.json';

const LANG_KEY = 'app_language';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
};

async function getStoredLanguage(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(LANG_KEY);
    if (stored) return stored;
  } catch {}
  const locales = ExpoLocalization.getLocales();
  const preferred = locales.find(l => l.languageCode === 'hi');
  return preferred ? 'hi' : 'en';
}

let initPromise: Promise<typeof i18next> | null = null;

export async function initI18n() {
  if (initPromise) return initPromise;

  const lng = await getStoredLanguage();

  initPromise = i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

  return initPromise;
}

export async function changeLanguage(lng: string) {
  await i18next.changeLanguage(lng);
  try {
    await SecureStore.setItemAsync(LANG_KEY, lng);
  } catch {}
}

export function getCurrentLanguage(): string {
  return i18next.language || 'hi';
}

export function getLanguageLabel(lng: string): string {
  return lng === 'hi' ? 'हिन्दी' : 'English';
}

export default i18next;
