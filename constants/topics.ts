import type { AppIconName } from "@/constants/app-icons";
import type { PuzzleTopic } from "@/types/puzzle";

export const TOPIC_ICON: Record<PuzzleTopic, AppIconName> = {
  addition: "addition", subtraction: "subtraction", multiplication: "multiplication",
  logic: "brain", patterns: "patterns", comparison: "scale", mental_math: "search",
  operations: "operations", fractions: "fractions", equality: "equality",
  estimation: "stats", division: "division",
};
