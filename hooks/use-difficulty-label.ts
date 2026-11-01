import { useTranslation } from "react-i18next";

import type { PuzzleDifficulty } from "@/types/puzzle";

export function useDifficultyLabel(difficulty: PuzzleDifficulty): string {
  const { t } = useTranslation();
  return t(`difficulty.${difficulty}`);
}
