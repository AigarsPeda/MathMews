import { LEARNING_CATALOG, getTopicLessons } from "@/constants/curriculum";

const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
const topicOrder = new Map(LEARNING_CATALOG.topics.map((topic, index) => [topic.id, index]));
const bosses = LEARNING_CATALOG.lessons.flatMap(lesson => lesson.levels
  .filter(level => level.kind === "boss" && level.story)
  .map(level => ({ id: level.id, level, lesson,
    lessonNumber: getTopicLessons(lesson.difficulty, lesson.topicId).findIndex(item => item.id === lesson.id) + 1,
    topic: LEARNING_CATALOG.topics.find(topic => topic.id === lesson.topicId)!,
  }))).sort((a, b) => difficultyOrder[a.lesson.difficulty] - difficultyOrder[b.lesson.difficulty]
    || topicOrder.get(a.topic.id)! - topicOrder.get(b.topic.id)!
    || a.lessonNumber - b.lessonNumber);

/** Saved puzzle IDs are the achievement record, including bosses finished before this page existed. */
export function getBossAchievements(completedPuzzleIds: readonly string[] = []) {
  const completed = new Set(completedPuzzleIds);
  return bosses.map(boss => {
    const stagesComplete = boss.level.puzzleIds.filter(id => completed.has(id)).length;
    return { ...boss, stagesComplete, collected: stagesComplete === boss.level.puzzleIds.length };
  });
}
export type BossAchievement = ReturnType<typeof getBossAchievements>[number];

/** The share action uses current saved completions, never the card's cached state. */
export function getShareableBossAchievement(id: string, completedPuzzleIds: readonly string[]) {
  return getBossAchievements(completedPuzzleIds).find(item => item.id === id && item.collected) ?? null;
}
