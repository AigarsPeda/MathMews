import type {
  VisualExplanation,
  VisualKeyframe,
  VisualScene,
} from "@/types/visual-explanation";

export function getVisualExplanation(
  puzzleId: string,
): VisualExplanation | null {
  return VISUAL_EXPLANATIONS[puzzleId] ?? null;
}

export function hasVisualExplanation(puzzleId: string): boolean {
  return puzzleId in VISUAL_EXPLANATIONS;
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

const VISUAL_EXPLANATIONS: Record<string, VisualExplanation> = {
  "easy-01": {
    puzzleId: "easy-01",
    keyframes: buildKeyframes([
      kf("easy01", { kind: "items", emoji: "🍎", count: 12 }),
      kf("easy01", {
        kind: "items",
        emoji: "🍎",
        count: 12,
        removed: 4,
      }),
      kf("easy01", {
        kind: "equation",
        lines: ["12 − 4 = ?", "Count what is left!"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-02": {
    puzzleId: "easy-02",
    keyframes: buildKeyframes([
      kf("easy02", { kind: "items", emoji: "🐑", count: 17 }),
      kf("easy02", {
        kind: "items",
        emoji: "🐑",
        count: 17,
        removed: 8,
      }),
      kf("easy02", {
        kind: "equation",
        lines: ['"All but 9" ran away', "How many stayed? 🐑"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-03": {
    puzzleId: "easy-03",
    keyframes: buildKeyframes([
      kf("easy03", {
        kind: "groups",
        emoji: "🎈",
        groups: [
          { count: 5, color: "#FF6B6B" },
          { count: 3, color: "#4ECDC4" },
        ],
      }),
      kf("easy03", {
        kind: "compare",
        left: { emoji: "🔴", count: 5 },
        right: { emoji: "🔵", count: 3 },
        operator: "+",
      }),
      kf("easy03", {
        kind: "equation",
        lines: ["5 + 3 = ?", "Put both groups together!"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-04": {
    puzzleId: "easy-04",
    keyframes: buildKeyframes([
      kf("easy04", {
        kind: "sequence",
        values: [2, 4, 6, 8, "?"],
        jumpLabel: "+2",
      }),
      kf("easy04", {
        kind: "sequence",
        values: [2, 4, 6, 8, "?"],
        highlightIndex: 3,
        jumpLabel: "+2",
      }),
      kf("easy04", {
        kind: "equation",
        lines: ["8 + 2 = ?", "What comes next?"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-05": {
    puzzleId: "easy-05",
    keyframes: buildKeyframes([
      kf("easy05", { kind: "items", emoji: "🍪", count: 10 }),
      kf("easy05", {
        kind: "items",
        emoji: "🍪",
        count: 10,
        removed: 3,
      }),
      kf("easy05", {
        kind: "equation",
        lines: ["10 − 3 = ?", "Count the cookies left!"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-06": {
    puzzleId: "easy-06",
    keyframes: buildKeyframes([
      kf("easy06", { kind: "grid", rows: 2, cols: 4, filled: 0 }),
      kf("easy06", { kind: "grid", rows: 2, cols: 4, filled: 4 }),
      kf("easy06", {
        kind: "equation",
        lines: ["2 rows × 4 toys", "2 × 4 = ? 🧸"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-07": {
    puzzleId: "easy-07",
    keyframes: buildKeyframes([
      kf("easy07", {
        kind: "sequence",
        values: [11, 12, 13, 14],
      }),
      kf("easy07", {
        kind: "sequence",
        values: [11, 12, 13, 14],
        highlightIndex: 0,
      }),
      kf("easy07", {
        kind: "equation",
        lines: ["Odd numbers: 11, 13", "Which one fits?"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-08": {
    puzzleId: "easy-08",
    keyframes: buildKeyframes([
      kf("easy08", {
        kind: "compare",
        left: { emoji: "🐚", count: 6 },
        right: { emoji: "🐚", count: 4 },
        operator: "+",
      }),
      kf("easy08", {
        kind: "groups",
        emoji: "🐚",
        groups: [
          { count: 6, color: "#FF6B6B" },
          { count: 4, color: "#4ECDC4" },
        ],
      }),
      kf("easy08", {
        kind: "equation",
        lines: ["6 + 4 = ?", "Add both piles together!"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-01": {
    puzzleId: "medium-01",
    keyframes: buildKeyframes([
      kf("medium01", { kind: "grid", rows: 4, cols: 6, filled: 0 }),
      kf("medium01", { kind: "grid", rows: 4, cols: 6, filled: 12 }),
      kf("medium01", {
        kind: "equation",
        lines: ["4 packs × 6 muffins", "4 × 6 = ? 🧁"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-02": {
    puzzleId: "medium-02",
    keyframes: buildKeyframes([
      kf("medium02", {
        kind: "equation",
        lines: ["$35 in wallet 💵"],
      }),
      kf("medium02", {
        kind: "compare",
        left: { emoji: "💵", count: 35, label: "start" },
        right: { emoji: "📚", count: 18, label: "book" },
        operator: "−",
      }),
      kf("medium02", {
        kind: "equation",
        lines: ["$35 − $18 = ?", "How much is left?"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-03": {
    puzzleId: "medium-03",
    keyframes: buildKeyframes([
      kf("medium03", {
        kind: "sequence",
        values: [3, 6, 12, 24, "?"],
        jumpLabel: "×2",
      }),
      kf("medium03", {
        kind: "sequence",
        values: [3, 6, 12, 24, "?"],
        highlightIndex: 3,
        jumpLabel: "×2",
      }),
      kf("medium03", {
        kind: "equation",
        lines: ["24 × 2 = ?", "Double 24!"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-04": {
    puzzleId: "medium-04",
    keyframes: buildKeyframes([
      kf("medium04", {
        kind: "items",
        emoji: "👧",
        count: 28,
        maxVisible: 14,
      }),
      kf("medium04", {
        kind: "grid",
        rows: 4,
        cols: 7,
        filled: 28,
      }),
      kf("medium04", {
        kind: "equation",
        lines: ["28 ÷ 4 teams = ?", "How many per team? 👧"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-05": {
    puzzleId: "medium-05",
    keyframes: buildKeyframes([
      kf("medium05", { kind: "grid", rows: 3, cols: 5, filled: 15 }),
      kf("medium05", { kind: "items", emoji: "🔵", count: 4 }),
      kf("medium05", {
        kind: "equation",
        lines: ["3 × 5 = 15", "15 + 4 = ? 🔵"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-06": {
    puzzleId: "medium-06",
    keyframes: buildKeyframes([
      kf("medium06", {
        kind: "equation",
        lines: ["Tens digit = 4", "Ones digit = 2 × 4"],
      }),
      kf("medium06", {
        kind: "sequence",
        values: [4, 8],
        highlightIndex: 1,
      }),
      kf("medium06", {
        kind: "equation",
        lines: ["4 and 8 → ?", "Put the digits together!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-01": {
    puzzleId: "hard-01",
    keyframes: buildKeyframes([
      kf("hard01", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 8,
        emoji: "🍕",
      }),
      kf("hard01", {
        kind: "groups",
        emoji: "🍕",
        groups: [
          { count: 3, color: "#FF6B6B" },
          { count: 2, color: "#4ECDC4" },
        ],
      }),
      kf("hard01", {
        kind: "compare",
        left: { emoji: "🍕", count: 3, label: "you" },
        right: { emoji: "🍕", count: 2, label: "friend" },
        operator: "+",
      }),
      kf("hard01", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 3,
        emoji: "🍕",
      }),
      kf("hard01", {
        kind: "equation",
        lines: [
          "3 + 2 = 5 eaten",
          "8 − 5 = 3 left",
          "Fraction: 3 out of 8 → ?/8",
        ],
        highlightLine: 2,
      }),
    ]),
  },
  "hard-02": {
    puzzleId: "hard-02",
    keyframes: buildKeyframes([
      kf("hard02", {
        kind: "compare",
        left: { emoji: "🚂", count: 60, label: "mi" },
        right: { emoji: "⏱️", count: 2, label: "hr" },
        operator: "÷",
      }),
      kf("hard02", {
        kind: "equation",
        lines: ["60 ÷ 2 = ? mph", "Find the speed first!"],
        highlightLine: 0,
      }),
      kf("hard02", {
        kind: "equation",
        lines: ["? × 5 hours", "How far in 5 hours? 🚂"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-03": {
    puzzleId: "hard-03",
    keyframes: buildKeyframes([
      kf("hard03", {
        kind: "equation",
        lines: ["Toy price: $40 🧸"],
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["Markup = 25% of $40", "25% → 25 out of every 100"],
        highlightLine: 0,
      }),
      kf("hard03", {
        kind: "sequence",
        values: [10, 10, 10, 10],
        highlightIndex: 0,
        jumpLabel: "$40 ÷ 4",
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["$40 ÷ 4 = $10", "25% markup = $10"],
        highlightLine: 0,
      }),
      kf("hard03", {
        kind: "compare",
        left: { emoji: "🧸", count: 40 },
        right: { emoji: "📈", count: 10 },
        operator: "+",
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["$40 + $10 = ?", "New price — your turn!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-04": {
    puzzleId: "hard-04",
    keyframes: buildKeyframes([
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
        addendIndices: [0, 1],
        highlightIndex: 2,
        jumpLabel: "1 + 1",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
        addendIndices: [1, 2],
        highlightIndex: 3,
        jumpLabel: "1 + 2",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
        addendIndices: [2, 3],
        highlightIndex: 4,
        jumpLabel: "2 + 3",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
        addendIndices: [3, 4],
        highlightIndex: 5,
        jumpLabel: "3 + 5",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, 8, "?"],
        addendIndices: [4, 5],
        highlightIndex: 6,
        jumpLabel: "5 + 8",
      }),
      kf("hard04", {
        kind: "equation",
        lines: ["5 + 8 = ?", "Add the last two numbers!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-05": {
    puzzleId: "hard-05",
    keyframes: buildKeyframes([
      kf("hard05", {
        kind: "grid",
        rows: 4,
        cols: 6,
        filled: 24,
        emoji: "🍪",
      }),
      kf("hard05", {
        kind: "items",
        emoji: "🍪",
        count: 24,
        removed: 5,
      }),
      kf("hard05", {
        kind: "items",
        emoji: "🍪",
        count: 24,
        removed: 12,
      }),
      kf("hard05", {
        kind: "equation",
        lines: ["24 − 5 − 7 = ?", "Count what is left!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-06": {
    puzzleId: "hard-06",
    keyframes: buildKeyframes([
      kf("hard06", { kind: "items", emoji: "🍎", count: 5 }),
      kf("hard06", {
        kind: "groups",
        emoji: "🍎",
        groups: [
          { count: 1, color: "#FF6B6B" },
          { count: 1, color: "#4ECDC4" },
          { count: 1, color: "#F7B731" },
        ],
      }),
      kf("hard06", {
        kind: "equation",
        lines: ["5 ÷ 3 friends = ?", "How many each? Any left? 🍎"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-09": {
    puzzleId: "easy-09",
    keyframes: buildKeyframes([
      kf("easy09", {
        kind: "sequence",
        values: [0, 1, 2, 3, 4],
        jumpLabel: "+",
      }),
      kf("easy09", {
        kind: "equation",
        lines: ["0 + 1 + 2 + 3 + 4 = 10", "Adding makes the total grow!"],
        highlightLine: 0,
      }),
      kf("easy09", {
        kind: "equation",
        lines: ["0 × 1 × 2 × 3 × 4 = 0", "Multiplying with 0 stays at 0!"],
        highlightLine: 0,
      }),
      kf("easy09", {
        kind: "compare",
        left: { emoji: "➕", count: 10, label: "sum" },
        right: { emoji: "✖️", count: 0, label: "product" },
        operator: "+",
      }),
    ]),
  },
  "easy-10": {
    puzzleId: "easy-10",
    keyframes: buildKeyframes([
      kf("easy10", {
        kind: "equation",
        lines: ["262 × 24", "262 × 23"],
      }),
      kf("easy10", {
        kind: "equation",
        lines: ["Same number: 262!", "262 × (24 − 23)"],
        highlightLine: 1,
      }),
      kf("easy10", {
        kind: "equation",
        lines: ["262 × 1 = ?", "What's the shortcut?"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-07": {
    puzzleId: "medium-07",
    keyframes: buildKeyframes([
      kf("medium07", {
        kind: "equation",
        lines: ["Start: 16", "Goal: 32 🎯"],
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["16 ÷ 4 = 4", "Split into a smaller number"],
        highlightLine: 0,
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["4 + 4 = 8", "Add the next step"],
        highlightLine: 0,
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["8 × 4 = 32", "Multiply to reach the goal!"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-08": {
    puzzleId: "medium-08",
    keyframes: buildKeyframes([
      kf("medium08", {
        kind: "sequence",
        values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        jumpLabel: "+",
      }),
      kf("medium08", {
        kind: "equation",
        lines: ["0 + 1 + … + 9 = 45", "Adding all numbers gives 45"],
        highlightLine: 0,
      }),
      kf("medium08", {
        kind: "equation",
        lines: ["0 × 1 × … × 9 = 0", "One zero makes the product zero!"],
        highlightLine: 0,
      }),
      kf("medium08", {
        kind: "compare",
        left: { emoji: "➕", count: 45, label: "sum" },
        right: { emoji: "✖️", count: 0, label: "product" },
        operator: "+",
      }),
    ]),
  },
  "hard-07": {
    puzzleId: "hard-07",
    keyframes: buildKeyframes([
      kf("hard07", {
        kind: "equation",
        lines: ["12   6   3   2", "Make 8!"],
        highlightLine: 0,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["Do × first!", "3 × 2 = 6"],
        highlightLine: 1,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["12 ÷ 6 = 2", "Divide first on the left"],
        highlightLine: 0,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["2 + 6 = 8", "Add last — order matters!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-08": {
    puzzleId: "hard-08",
    keyframes: buildKeyframes([
      kf("hard08", {
        kind: "equation",
        lines: ["Start: 8", "Goal: 20 🎯"],
      }),
      kf("hard08", {
        kind: "equation",
        lines: ["8 × 2 = 16", "Double the start!"],
        highlightLine: 0,
      }),
      kf("hard08", {
        kind: "equation",
        lines: ["16 + 4 = 20", "Add a little more to finish!"],
        highlightLine: 0,
      }),
    ]),
  },
};
