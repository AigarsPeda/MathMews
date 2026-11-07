import reviews from '@/data/everyday-reviews.json';
import type { EverydayModel } from '@/types/everyday';
import type { LearningText } from '@/types/curriculum';
import type { AppLocale } from '@/types/locale';

type Review = { prompt: LearningText; explanation: LearningText; choices: LearningText[]; correctIndex: number; model: Omit<EverydayModel, 'label'> & { label: LearningText } };
const catalog = reviews as unknown as Record<string, Review[]>;
export function getEverydayReview(lessonId: string, day: number) {
  const variants = catalog[lessonId];
  if (!variants) return undefined;
  const review = variants[((day % variants.length) + variants.length) % variants.length];
  return { ...review, choices: review.choices.map(text => text.en),
    localizedChoices: Object.fromEntries((['en', 'lv', 'ru'] as const).map(locale => [locale, review.choices.map(text => text[locale])])) as Record<AppLocale, string[]>,
    models: Object.fromEntries((['en', 'lv', 'ru'] as const).map(locale => [locale, { ...review.model, label: review.model.label[locale] }])) as Record<AppLocale, EverydayModel> };
}
