import type { Puzzle } from "@/types/puzzle";
import type {
  VisualExplanation,
  VisualKeyframe,
  VisualScene,
} from "@/types/visual-explanation";
import { getPuzzleType } from "@/utils/puzzle-type";

export function getVisualHelpTemplateKey(puzzle: Puzzle): string {
  const type = getPuzzleType(puzzle);
  if (type === "multiple_choice") {
    return `multiple_choice-${puzzle.difficulty}`;
  }
  return type;
}

export function getVisualExplanation(puzzle: Puzzle): VisualExplanation | null {
  const template = VISUAL_TEMPLATES[getVisualHelpTemplateKey(puzzle)];
  if (!template) return null;
  return { puzzleId: puzzle.id, keyframes: template };
}

export function hasVisualExplanation(puzzle: Puzzle): boolean {
  return getVisualHelpTemplateKey(puzzle) in VISUAL_TEMPLATES;
}

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

type KeyframeInput = {
  puzzleKey: string;
  scene: VisualScene;
};

function kf(puzzleKey: string, scene: VisualScene): KeyframeInput {
  return { puzzleKey, scene };
}

function buildKeyframes(inputs: KeyframeInput[]): VisualKeyframe[] {
  const count = inputs.length;
  return inputs.map((input, index) => ({
    at: count <= 1 ? 0 : index / (count - 1),
    captionKey: `visualHelp.${input.puzzleKey}.s${index}`,
    scene: input.scene,
  }));
}

const VISUAL_TEMPLATES: Record<string, VisualKeyframe[]> = {
  "multiple_choice-easy": buildKeyframes([
    kf("multipleChoiceEasy", { kind: "items", emoji: "🍎", count: 8 }),
    kf("multipleChoiceEasy", {
      kind: "items",
      emoji: "🍎",
      count: 8,
      removed: 3,
    }),
    kf("multipleChoiceEasy", {
      kind: "equation",
      lines: ["Picture the story", "Add or subtract to find the answer"],
      highlightLine: 1,
    }),
  ]),
  "multiple_choice-medium": buildKeyframes([
    kf("multipleChoiceMedium", {
      kind: "equation",
      lines: ["Money you have 💵"],
    }),
    kf("multipleChoiceMedium", {
      kind: "compare",
      left: { emoji: "💵", count: 20, label: "start" },
      right: { emoji: "📚", count: 7, label: "spent" },
      operator: "−",
    }),
    kf("multipleChoiceMedium", {
      kind: "equation",
      lines: ["Start − spent", "What stays in the wallet?"],
      highlightLine: 0,
    }),
  ]),
  "multiple_choice-hard": buildKeyframes([
    kf("multipleChoiceHard", {
      kind: "compare",
      left: { emoji: "🚂", count: 40, label: "mi" },
      right: { emoji: "⏱️", count: 4, label: "hr" },
      operator: "÷",
    }),
    kf("multipleChoiceHard", {
      kind: "equation",
      lines: ["Distance ÷ time = speed", "Find the rate first"],
      highlightLine: 0,
    }),
    kf("multipleChoiceHard", {
      kind: "equation",
      lines: ["Use the rate for the new amount", "Multiply or divide as needed"],
      highlightLine: 0,
    }),
  ]),
  compare: buildKeyframes([
    kf("compare", {
      kind: "sequence",
      values: [1, 2, 3, 4],
      jumpLabel: "+",
    }),
    kf("compare", {
      kind: "equation",
      lines: ["Work each side separately", "Then pick the bigger result"],
      highlightLine: 0,
    }),
    kf("compare", {
      kind: "compare",
      left: { emoji: "➕", count: 5, label: "A" },
      right: { emoji: "✖️", count: 0, label: "B" },
      operator: "+",
    }),
  ]),
  operation_path: buildKeyframes([
    kf("operationPath", {
      kind: "equation",
      lines: ["Start number → goal 🎯"],
    }),
    kf("operationPath", {
      kind: "equation",
      lines: ["Try ÷ to make smaller", "Or × to make bigger"],
      highlightLine: 0,
    }),
    kf("operationPath", {
      kind: "equation",
      lines: ["Check after each step", "Chain operators to reach the goal!"],
      highlightLine: 0,
    }),
  ]),
  target_build: buildKeyframes([
    kf("targetBuild", {
      kind: "equation",
      lines: ["Numbers + operators", "One target to hit"],
      highlightLine: 0,
    }),
    kf("targetBuild", {
      kind: "equation",
      lines: ["× and ÷ first!", "Before + and −"],
      highlightLine: 0,
    }),
    kf("targetBuild", {
      kind: "equation",
      lines: ["Build the expression", "Order matters — try on your nut!"],
      highlightLine: 0,
    }),
  ]),
  fraction_build: buildKeyframes([
    kf("fractionBuild", {
      kind: "grid",
      rows: 2,
      cols: 3,
      filled: 0,
      emoji: "🍕",
    }),
    kf("fractionBuild", {
      kind: "grid",
      rows: 2,
      cols: 3,
      filled: 2,
      emoji: "🍕",
    }),
    kf("fractionBuild", {
      kind: "equation",
      lines: ["Equal slices first", "Shaded ÷ total = fraction"],
      highlightLine: 1,
    }),
  ]),
  true_false: buildKeyframes([
    kf("trueFalse", {
      kind: "equation",
      lines: ["Statement says an answer", "Do not trust it yet"],
      highlightLine: 0,
    }),
    kf("trueFalse", {
      kind: "equation",
      lines: ["Calculate yourself", "? × ? = ?"],
      highlightLine: 0,
    }),
    kf("trueFalse", {
      kind: "equation",
      lines: ["Compare your result", "True only if they match!"],
      highlightLine: 1,
    }),
  ]),
  balance: buildKeyframes([
    kf("balance", {
      kind: "equation",
      lines: ["Left side ↔ right side", "Must be equal when balanced"],
    }),
    kf("balance", {
      kind: "equation",
      lines: ["Find the missing piece", "? makes both sides match"],
      highlightLine: 1,
    }),
  ]),
  number_line: buildKeyframes([
    kf("numberLine", {
      kind: "numberline",
      min: 0,
      max: 15,
      markers: [6],
      highlight: 6,
    }),
    kf("numberLine", {
      kind: "numberline",
      min: 0,
      max: 15,
      markers: [6, 9],
      highlight: 9,
    }),
    kf("numberLine", {
      kind: "equation",
      lines: ["+ jumps right", "− jumps left — count each step"],
      highlightLine: 0,
    }),
  ]),
  pair_sum: buildKeyframes([
    kf("pairSum", {
      kind: "sequence",
      values: [2, 5, 8, 1],
    }),
    kf("pairSum", {
      kind: "sequence",
      values: [2, 5, 8, 1],
      addendIndices: [0, 1],
    }),
    kf("pairSum", {
      kind: "equation",
      lines: ["Pick two numbers", "Do they add to the target?"],
      highlightLine: 1,
    }),
  ]),
  fix_mistake: buildKeyframes([
    kf("fixMistake", {
      kind: "equation",
      lines: ["Someone wrote an answer", "Does it look right?"],
      highlightLine: 0,
    }),
    kf("fixMistake", {
      kind: "equation",
      lines: ["8 + 5 = ?", "Work it out yourself"],
      highlightLine: 0,
    }),
    kf("fixMistake", {
      kind: "equation",
      lines: ["Compare to what they wrote", "What mistake did they make?"],
      highlightLine: 1,
    }),
  ]),
  estimate: buildKeyframes([
    kf("estimate", {
      kind: "equation",
      lines: ["Round to the nearest ten", "Make numbers easy"],
      highlightLine: 0,
    }),
    kf("estimate", {
      kind: "equation",
      lines: ["Add the rounded numbers", "Get a rough total"],
      highlightLine: 0,
    }),
    kf("estimate", {
      kind: "equation",
      lines: ["Pick the closest choice", "It does not need to be exact!"],
      highlightLine: 0,
    }),
  ]),
  fair_share: buildKeyframes([
    kf("fairShare", {
      kind: "items",
      emoji: "🍪",
      count: 7,
      maxVisible: 7,
    }),
    kf("fairShare", {
      kind: "groups",
      emoji: "🍪",
      groups: [
        { count: 2, color: "#FF6B6B" },
        { count: 2, color: "#4ECDC4" },
        { count: 2, color: "#F7B731" },
      ],
    }),
    kf("fairShare", {
      kind: "equation",
      lines: ["Deal one round at a time", "Per person + leftovers"],
      highlightLine: 0,
    }),
  ]),
  fraction_equivalent: buildKeyframes([
    kf("fractionEquivalent", {
      kind: "grid",
      rows: 1,
      cols: 2,
      filled: 1,
      emoji: "🍕",
    }),
    kf("fractionEquivalent", {
      kind: "grid",
      rows: 2,
      cols: 4,
      filled: 4,
      emoji: "🍕",
    }),
    kf("fractionEquivalent", {
      kind: "equation",
      lines: ["Same area, more slices", "Which fraction matches?"],
      highlightLine: 0,
    }),
  ]),
  fraction_match: buildKeyframes([
    kf("fractionMatch", {
      kind: "grid",
      rows: 2,
      cols: 3,
      filled: 1,
      emoji: "🍰",
    }),
    kf("fractionMatch", {
      kind: "equation",
      lines: ["Shaded parts ÷ total parts", "That is the fraction!"],
      highlightLine: 0,
    }),
    kf("fractionMatch", {
      kind: "equation",
      lines: ["Tap a fraction", "Then tap the picture that matches"],
      highlightLine: 1,
    }),
  ]),
  pattern_next: buildKeyframes([
    kf("patternNext", {
      kind: "sequence",
      values: [2, 4, 6, 8, "?"],
      jumpLabel: "+2",
    }),
    kf("patternNext", {
      kind: "sequence",
      values: [2, 4, 6, 8, "?"],
      highlightIndex: 3,
      jumpLabel: "+2",
    }),
    kf("patternNext", {
      kind: "equation",
      lines: ["Same jump every time", "Use it for the next number"],
      highlightLine: 0,
    }),
  ]),
  function_machine: buildKeyframes([
    kf("functionMachine", {
      kind: "equation",
      lines: ["A number goes IN →", "🔢 → ❓"],
      highlightLine: 0,
    }),
    kf("functionMachine", {
      kind: "equation",
      lines: ["The machine uses ONE rule", "+  −  ×  or  ÷"],
      highlightLine: 0,
    }),
    kf("functionMachine", {
      kind: "equation",
      lines: ["A different number comes OUT", "Which rule fits both?"],
      highlightLine: 1,
    }),
  ]),
  order_numbers: buildKeyframes([
    kf("orderNumbers", {
      kind: "sequence",
      values: [15, 3, 9, 7],
    }),
    kf("orderNumbers", {
      kind: "equation",
      lines: ["Smallest on the left", "Biggest on the right"],
      highlightLine: 0,
    }),
    kf("orderNumbers", {
      kind: "sequence",
      values: [3, 7, 9, 15],
      highlightIndex: 0,
    }),
  ]),
};
