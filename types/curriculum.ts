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
export type BossStory = {
  sceneId: string;
  backstory?: LearningText;
  /** Cat participation before the mission and after its three tasks. */
  catActions: LearningText[];
  intro: LearningText;
  outcome: LearningText;
  stages: { title: LearningText; before: LearningText; after: LearningText }[];
};
export type LearningLevel = {
  id: string;
  kind: "practice" | "boss" | "challenge";
  title: LearningText;
  description: LearningText;
  story?: BossStory;
  /** Only challenges have a deadline; practice and story bosses remain untimed. */
  timeLimitSeconds?: number;
  /** Boss stages are separate puzzles, saved after each successful stage. */
  puzzleIds: string[];
};
export type LearningLesson = {
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
