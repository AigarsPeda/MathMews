import type { Puzzle } from "@/types/puzzle";
import { useTranslation } from "react-i18next";

export function useTopicLabel(topic: Puzzle["topic"]): string {
  const { t } = useTranslation();
  return t(`topic.${topic}`);
}
