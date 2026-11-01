import { VISUAL_PRACTICE } from "@/constants/visual-practice";
import type { Puzzle } from "@/types/puzzle";
import type { VisualExplanation, VisualKeyframe } from "@/types/visual-explanation";
import { getPuzzleType } from "@/utils/puzzle-type";

// These examples use their own quantities. Never build help from the active
// puzzle's question, hint, answer, payload, or authored solution scenes.
// Both directions use a separate practice number line, never the current puzzle.
export const NUMBER_LINE_EXAMPLES = {
  forward: [0, 1, 2].map((moves): VisualKeyframe => ({
    at: moves / 2,
    captionKey: `visualHelp.numberLine.forward.s${moves}`,
    scene: { kind: "numberline_jump", start: 4, jump: 2, moves },
  })),
  back: [0, 1, 2].map((moves): VisualKeyframe => ({
    at: moves / 2,
    captionKey: `visualHelp.numberLine.back.s${moves}`,
    scene: { kind: "numberline_jump", start: 4, jump: -2, moves },
  })),
};

const VISUAL_EXAMPLES = { ...VISUAL_PRACTICE, number_line: NUMBER_LINE_EXAMPLES.forward };

type ExampleKey = keyof typeof VISUAL_EXAMPLES;

export function getVisualHelpTemplateKey(puzzle: Puzzle): ExampleKey {
  if (puzzle.helpTemplate) return puzzle.helpTemplate;
  const type = getPuzzleType(puzzle);
  if (type === "decimal_grid") return "decimal_grid_100";
  if (type === "decimal_place_value") return "decimal_place_build";
  if (type === "fraction_strip") return "fraction_strip_build";
  if (type === "place_value") return "base_ten_build";
  if (type === "find_all_pairs") return "all_pairs";
  if (type !== "multiple_choice") return type;
  switch (puzzle.topic) {
    case "addition": return "addition";
    case "subtraction": return "subtraction";
    case "multiplication": return "multiplication";
    case "division": return "division";
    case "fractions": return "fraction_build";
    case "comparison": return "compare";
    case "patterns": return "pattern_next";
    case "equality": return "balance";
    case "estimation": return "estimate";
    case "mental_math": return "pair_sum";
    case "operations": return "target_build";
    case "logic": return "odd_range";
  }
}

export function getVisualExplanation(puzzle: Puzzle): VisualExplanation {
  const template = getVisualHelpTemplateKey(puzzle);
  return { puzzleId: puzzle.id, titleKey: template === "number_line" ? "visualHelp.numberLine.title" : `visualHelp.lessons.${template}.title`, keyframes: VISUAL_EXAMPLES[template] };
}

export function hasVisualExplanation(_puzzle: Puzzle): boolean { return true; }

export function progressForVisualHelpStep(
  stepIndex: number,
  stepCount: number,
): number {
  if (stepCount <= 1) return 0;
  const clampedIndex = Math.max(0, Math.min(stepIndex, stepCount - 1));
  return clampedIndex / (stepCount - 1);
}
