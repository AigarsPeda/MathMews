import type { AppIconName } from "@/constants/app-icons";
import type { AppLocale } from "@/types/locale";
import type { PuzzleDifficulty } from "@/types/puzzle";

export type LearningText = Record<AppLocale, string>;
export type LearningTopic = {
  id: string;
  title: LearningText;
  description: LearningText;
  icon: AppIconName;
};
export type LearningLevel = {
  id: string;
  kind: "practice" | "challenge";
  title: LearningText;
  description: LearningText;
  /** Challenges offer a choice between timed and untimed play. */
  timeLimitSeconds?: number;
  /** Older grouped tasks retain their original IDs for saved progress and links. */
  puzzleIds: string[];
};
export type LearningLesson = {
  /** A practical outcome shown after all ten tasks, without a collectible reward. */
  completion?: LearningText;
  /** New paths have seven practice tasks, a challenge and two path reviews. */
  format?: "path";
  skillId?: string;
  prerequisiteSkillIds?: string[];
  review?: boolean;
  id: string;
  difficulty: PuzzleDifficulty;
  topicId: string;
  title: LearningText;
  description: LearningText;
  levels: LearningLevel[];
};
export type LearningCatalog = {
  version: number;
  topics: LearningTopic[];
  lessons: LearningLesson[];
};
