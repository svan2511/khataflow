import { useTranslation } from 'react-i18next';
import type en from '@/locales/en.json';

type TranslationKeys = keyof typeof en;

export function useI18n() {
  return useTranslation();
}

export type { TranslationKeys };
