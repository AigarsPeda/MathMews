import type { Puzzle } from "@/types/puzzle";
import type {
  VisualExplanation,
  VisualKeyframe,
  VisualScene,
} from "@/types/visual-explanation";
import { getPuzzleType } from "@/utils/puzzle-type";

// These examples use their own quantities. Never build help from the active
// puzzle's question, hint, answer, payload, or authored solution scenes.
function example(caption: string, scenes: [VisualScene, VisualScene, VisualScene]): VisualKeyframe[] {
  return scenes.map((scene, index) => ({
    at: index / 2,
    captionKey: `visualHelp.${caption}.s${index}`,
    scene,
  }));
}

function equation(...lines: string[]): VisualScene {
  return { kind: "equation", lines };
}

const VISUAL_EXAMPLES = {
  subtraction: example("easy01", [
    { kind: "items", emoji: "🍎", count: 7 },
    { kind: "items", emoji: "🍎", count: 7, removed: 2 },
    equation("7 − 2 = 5"),
  ]),
  addition: example("easy03", [
    { kind: "groups", emoji: "🎈", groups: [{ count: 2, color: "#C73948" }, { count: 4, color: "#23766F" }] },
    { kind: "items", emoji: "🎈", count: 6 },
    equation("2 + 4 = 6"),
  ]),
  multiplication: example("medium01", [
    { kind: "grid", rows: 3, cols: 3, filled: 3, emoji: "🧸" },
    { kind: "grid", rows: 3, cols: 3, filled: 9, emoji: "🧸" },
    equation("3 × 3 = 9"),
  ]),
  division: example("medium04", [
    { kind: "items", emoji: "🍪", count: 8 },
    { kind: "groups", emoji: "🍪", groups: [{ count: 4, color: "#23766F" }, { count: 4, color: "#C73948" }] },
    equation("8 ÷ 2 = 4"),
  ]),
  all_but: example("allButExample", [
    { kind: "items", emoji: "🐑", count: 6 },
    { kind: "items", emoji: "🐑", count: 6, removed: 4 },
    { kind: "items", emoji: "🐑", count: 2 },
  ]),
  odd_range: example("oddRange", [
    equation("4 < ? < 7"),
    { kind: "sequence", values: [5, 6] },
    { kind: "numberline", min: 4, max: 7, markers: [4, 5, 6, 7], highlight: 5 },
  ]),
  place_value: example("placeValueExample", [
    equation("3 × 10", "? × 1"),
    equation("3 × 2 = 6"),
    equation("30 + 6 = 36"),
  ]),
  multiply_add: example("medium05", [
    { kind: "grid", rows: 2, cols: 3, filled: 6, emoji: "🔵" },
    { kind: "groups", emoji: "🔵", groups: [{ count: 6, color: "#23766F" }, { count: 2, color: "#C73948" }] },
    equation("2 × 3 = 6", "6 + 2 = 8"),
  ]),
  multiply_subtract: example("hard05", [
    { kind: "grid", rows: 3, cols: 3, filled: 9, emoji: "🍪" },
    equation("9 − 2 = 7"),
    equation("7 − 1 = 6"),
  ]),
  fraction_left: example("fractionLeft", [
    { kind: "fraction", numerator: 6, denominator: 6 },
    equation("1 + 2 = 3", "6 − 3 = 3"),
    { kind: "fraction", numerator: 3, denominator: 6 },
  ]),
  rate: example("hard02", [
    equation("24 ÷ 3 = ?"),
    equation("24 ÷ 3 = 8"),
    equation("8 × 4 = 32"),
  ]),
  percent: example("percentExample", [
    equation("25% × 20 = ?"),
    equation("20 ÷ 4 = 5"),
    equation("20 + 5 = 25"),
  ]),
  compare: example("compare", [
    equation("2 + 4", "2 × 0"),
    equation("2 + 4 = 6", "2 × 0 = 0"),
    equation("6 > 0"),
  ]),
  operation_path: example("operationPath", [
    equation("9 → ? → 10"),
    equation("9 ÷ 3 = 3"),
    equation("3 + 7 = 10"),
  ]),
  target_build: example("targetBuild", [
    equation("3 ? 2 ? 5 = 13"),
    equation("2 × 5 = 10"),
    equation("3 + 2 × 5 = 13"),
  ]),
  fraction_build: example("fractionBuild", [
    { kind: "fraction", numerator: 0, denominator: 5 },
    { kind: "fraction", numerator: 2, denominator: 5 },
    equation("2 / 5"),
  ]),
  true_false: example("trueFalse", [
    equation("3 × 3 = 8"),
    equation("3 + 3 + 3 = 9"),
    equation("9 ≠ 8"),
  ]),
  balance: example("balance", [
    equation("4 + ? = 10"),
    equation("10 − 4 = 6"),
    equation("4 + 6 = 10"),
  ]),
  number_line: example("numberLine", [
    { kind: "numberline", min: 0, max: 10, markers: [4], highlight: 4 },
    { kind: "numberline", min: 0, max: 10, markers: [4, 5, 6, 7], highlight: 7 },
    equation("4 + 3 = 7"),
  ]),
  pair_sum: example("pairSum", [
    equation("2 + ? = 8"),
    { kind: "sequence", values: [2, 6, 3, 1], addendIndices: [0, 1] },
    equation("2 + 6 = 8"),
  ]),
  fix_mistake: example("fixMistake", [
    equation("9 − 3 = 7"),
    equation("9 − 3 = 6"),
    equation("6 ≠ 7"),
  ]),
  estimate: example("estimate", [
    equation("32 + 46 ≈ ?"),
    equation("32 ≈ 30", "46 ≈ 50"),
    equation("30 + 50 = 80"),
  ]),
  fair_share: example("fairShare", [
    { kind: "items", emoji: "🍪", count: 9 },
    { kind: "groups", emoji: "🍪", groups: [{ count: 4, color: "#23766F" }, { count: 4, color: "#23766F" }, { count: 1, color: "#99501A" }] },
    equation("9 = 2 × 4 + 1"),
  ]),
  fraction_equivalent: example("fractionEquivalent", [
    { kind: "fraction", numerator: 1, denominator: 3 },
    { kind: "fraction", numerator: 2, denominator: 6 },
    equation("1 / 3 = 2 / 6"),
  ]),
  fraction_match: example("fractionMatch", [
    { kind: "fraction", numerator: 3, denominator: 5 },
    equation("3 / 5"),
    { kind: "fraction", numerator: 3, denominator: 5 },
  ]),
  pattern_next: example("patternNext", [
    { kind: "sequence", values: [3, 6, 9, "?"] },
    { kind: "sequence", values: [3, 6, 9, "?"], jumpLabel: "+3" },
    { kind: "sequence", values: [3, 6, 9, 12], highlightIndex: 3, jumpLabel: "+3" },
  ]),
  function_machine: example("functionMachine", [
    equation("4 → ? → 12"),
    equation("4 × 3 = 12"),
    equation("4 → ×3 → 12"),
  ]),
  order_numbers: example("orderNumbers", [
    { kind: "sequence", values: [8, 2, 6] },
    { kind: "sequence", values: [2, 8, 6], highlightIndex: 0 },
    { kind: "sequence", values: [2, 6, 8] },
  ]),
};

type ExampleKey = keyof typeof VISUAL_EXAMPLES;

// Story puzzles need a concept match, rather than one example per difficulty.
const STORY_EXAMPLES: Record<string, ExampleKey> = {
  "easy-mc-02": "all_but",
  "easy-mc-06": "odd_range",
  "medium-mc-03": "division",
  "medium-mc-04": "multiply_add",
  "medium-mc-05": "place_value",
  "hard-mc-01": "fraction_left",
  "hard-mc-02": "rate",
  "hard-mc-03": "percent",
  "hard-mc-04": "multiply_subtract",
  "hard-mc-05": "fair_share",
};

export function getVisualHelpTemplateKey(puzzle: Puzzle): ExampleKey {
  const type = getPuzzleType(puzzle);
  if (type !== "multiple_choice") return type;
  if (STORY_EXAMPLES[puzzle.id]) return STORY_EXAMPLES[puzzle.id];
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
  return { puzzleId: puzzle.id, keyframes: VISUAL_EXAMPLES[getVisualHelpTemplateKey(puzzle)] };
}

export function hasVisualExplanation(_puzzle: Puzzle): boolean { return true; }

type InterpolatedFrame = {
  captionKey: string;
  scene: VisualScene;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundLerp(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}

function interpolateScene(
  from: VisualScene,
  to: VisualScene,
  t: number,
): VisualScene {
  if (from.kind !== to.kind) return t < 0.5 ? from : to;

  switch (from.kind) {
    case "items": {
      if (to.kind !== "items") return from;
      return {
        ...from,
        count: roundLerp(from.count, to.count, t),
        removed: roundLerp(from.removed ?? 0, to.removed ?? 0, t),
      };
    }
    case "groups": {
      if (to.kind !== "groups") return from;
      return {
        ...from,
        groups: from.groups.map((group, index) => ({
          ...group,
          count: roundLerp(
            group.count,
            to.groups[index]?.count ?? group.count,
            t,
          ),
        })),
      };
    }
    case "grid": {
      if (to.kind !== "grid") return from;
      return {
        ...from,
        filled: roundLerp(from.filled, to.filled, t),
      };
    }
    case "compare": {
      if (to.kind !== "compare") return from;
      return {
        ...from,
        left: {
          ...from.left,
          count: roundLerp(from.left.count, to.left.count, t),
        },
        right: {
          ...from.right,
          count: roundLerp(from.right.count, to.right.count, t),
        },
        result: undefined,
      };
    }
    default:
      return t < 0.5 ? from : to;
  }
}

export function interpolateVisualFrame(
  keyframes: VisualKeyframe[],
  progress: number,
): InterpolatedFrame {
  const clamped = Math.max(0, Math.min(1, progress));
  if (keyframes.length === 0) {
    return {
      captionKey: "",
      scene: { kind: "equation", lines: ["?"] },
    };
  }
  if (keyframes.length === 1) {
    return {
      captionKey: keyframes[0].captionKey,
      scene: keyframes[0].scene,
    };
  }

  const scaled = clamped * (keyframes.length - 1);
  const index = Math.min(Math.floor(scaled), keyframes.length - 2);
  const t = scaled - index;
  const from = keyframes[index];
  const to = keyframes[index + 1];

  return {
    captionKey: t < 0.5 ? from.captionKey : to.captionKey,
    scene: interpolateScene(from.scene, to.scene, t),
  };
}

export type VisualFrameBlend = {
  from: VisualKeyframe;
  to: VisualKeyframe;
  blend: number;
  segmentIndex: number;
};

export function getVisualFrameBlend(
  keyframes: VisualKeyframe[],
  progress: number,
): VisualFrameBlend {
  const clamped = Math.max(0, Math.min(1, progress));
  if (keyframes.length === 0) {
    const empty: VisualKeyframe = {
      at: 0,
      captionKey: "",
      scene: { kind: "equation", lines: ["?"] },
    };
    return { from: empty, to: empty, blend: 0, segmentIndex: 0 };
  }
  if (keyframes.length === 1) {
    return {
      from: keyframes[0],
      to: keyframes[0],
      blend: 0,
      segmentIndex: 0,
    };
  }

  const scaled = clamped * (keyframes.length - 1);
  const segmentIndex = Math.min(Math.floor(scaled), keyframes.length - 2);
  const blend = scaled - segmentIndex;

  return {
    from: keyframes[segmentIndex],
    to: keyframes[segmentIndex + 1],
    blend,
    segmentIndex,
  };
}

export function snapVisualHelpProgress(
  progress: number,
  stepCount: number,
): number {
  if (stepCount <= 1) return 0;
  const scaled = Math.max(0, Math.min(1, progress)) * (stepCount - 1);
  const nearestIndex = Math.round(scaled);
  return nearestIndex / (stepCount - 1);
}

export function progressForVisualHelpStep(
  stepIndex: number,
  stepCount: number,
): number {
  if (stepCount <= 1) return 0;
  const clampedIndex = Math.max(0, Math.min(stepIndex, stepCount - 1));
  return clampedIndex / (stepCount - 1);
}
