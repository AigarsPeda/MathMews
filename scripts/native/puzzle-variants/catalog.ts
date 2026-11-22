import { getLevelPuzzles, LEARNING_CATALOG } from '@/constants/curriculum';
import { PUZZLE_PATHS } from '@/constants/puzzle-path';
import type { AppLocale } from '@/types/locale';

/** Use each topic's opening practice puzzle so repeated visits show the same task. */
export function getTopicPreviews(locale: AppLocale) {
  return LEARNING_CATALOG.topics.map(topic => {
    const lesson = PUZZLE_PATHS.find(path => path.topicId === topic.id)!;
    const level = lesson.levels.find(step => step.kind === 'practice')!;
    const [puzzle] = getLevelPuzzles(locale, lesson, level);
    return { topic, puzzle, session: { lesson, level, phase: 0 } };
  });
}
