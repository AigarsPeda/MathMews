import { VISUAL_PRACTICE } from "@/constants/visual-practice";
import type { Puzzle } from "@/types/puzzle";
import type {
  VisualExplanation,
  VisualKeyframe,
  VisualScene,
} from "@/types/visual-explanation";
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
  const template = getVisualHelpTemplateKey(puzzle);
  return { puzzleId: puzzle.id, titleKey: template === "number_line" ? "visualHelp.numberLine.title" : `visualHelp.lessons.${template}.title`, keyframes: VISUAL_EXAMPLES[template] };
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
