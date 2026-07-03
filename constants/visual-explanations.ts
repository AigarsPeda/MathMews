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
      kf("easy01", { kind: "items", emoji: "🍎", count: 8 }),
      kf("easy01", {
        kind: "items",
        emoji: "🍎",
        count: 8,
        removed: 3,
      }),
      kf("easy01", {
        kind: "equation",
        lines: ["Take away → subtract", "Count what is left"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-02": {
    puzzleId: "easy-02",
    keyframes: buildKeyframes([
      kf("easy02", { kind: "items", emoji: "🐦", count: 10 }),
      kf("easy02", {
        kind: "items",
        emoji: "🐦",
        count: 10,
        removed: 7,
      }),
      kf("easy02", {
        kind: "equation",
        lines: ['"All but 3" flew away', "3 stayed — not 7!"],
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
          { count: 4, color: "#FF6B6B" },
          { count: 2, color: "#4ECDC4" },
        ],
      }),
      kf("easy03", {
        kind: "compare",
        left: { emoji: "🔴", count: 4 },
        right: { emoji: "🔵", count: 2 },
        operator: "+",
      }),
      kf("easy03", {
        kind: "equation",
        lines: ["Two groups → one total", "Add the amounts"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-04": {
    puzzleId: "easy-04",
    keyframes: buildKeyframes([
      kf("easy04", {
        kind: "sequence",
        values: [1, 3, 5, 7, "?"],
        jumpLabel: "+2",
      }),
      kf("easy04", {
        kind: "sequence",
        values: [1, 3, 5, 7, "?"],
        highlightIndex: 3,
        jumpLabel: "+2",
      }),
      kf("easy04", {
        kind: "equation",
        lines: ["Same jump every time", "Use it for the next number"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-05": {
    puzzleId: "easy-05",
    keyframes: buildKeyframes([
      kf("easy05", { kind: "items", emoji: "🍪", count: 7 }),
      kf("easy05", {
        kind: "items",
        emoji: "🍪",
        count: 7,
        removed: 2,
      }),
      kf("easy05", {
        kind: "equation",
        lines: ["Whole − taken away", "How many remain?"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-06": {
    puzzleId: "easy-06",
    keyframes: buildKeyframes([
      kf("easy06", { kind: "grid", rows: 3, cols: 2, filled: 0 }),
      kf("easy06", { kind: "grid", rows: 3, cols: 2, filled: 6 }),
      kf("easy06", {
        kind: "equation",
        lines: ["Rows × columns", "Counts every spot in the grid"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-07": {
    puzzleId: "easy-07",
    keyframes: buildKeyframes([
      kf("easy07", {
        kind: "sequence",
        values: [7, 8, 9, 10, 11],
      }),
      kf("easy07", {
        kind: "sequence",
        values: [7, 8, 9, 10, 11],
        highlightIndex: 4,
      }),
      kf("easy07", {
        kind: "equation",
        lines: ["Odd = not in pairs", "Pick one that fits every clue"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-08": {
    puzzleId: "easy-08",
    keyframes: buildKeyframes([
      kf("easy08", {
        kind: "compare",
        left: { emoji: "🐚", count: 3 },
        right: { emoji: "🐚", count: 4 },
        operator: "+",
      }),
      kf("easy08", {
        kind: "groups",
        emoji: "🐚",
        groups: [
          { count: 3, color: "#FF6B6B" },
          { count: 4, color: "#4ECDC4" },
        ],
      }),
      kf("easy08", {
        kind: "equation",
        lines: ["Merge the piles", "Add — nothing taken away"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-01": {
    puzzleId: "medium-01",
    keyframes: buildKeyframes([
      kf("medium01", { kind: "grid", rows: 3, cols: 4, filled: 0 }),
      kf("medium01", { kind: "grid", rows: 3, cols: 4, filled: 8 }),
      kf("medium01", {
        kind: "equation",
        lines: ["Same size in each pack", "Packs × per pack = total"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-02": {
    puzzleId: "medium-02",
    keyframes: buildKeyframes([
      kf("medium02", {
        kind: "equation",
        lines: ["Money you have 💵"],
      }),
      kf("medium02", {
        kind: "compare",
        left: { emoji: "💵", count: 20, label: "start" },
        right: { emoji: "📚", count: 7, label: "spent" },
        operator: "−",
      }),
      kf("medium02", {
        kind: "equation",
        lines: ["Start − spent", "What stays in the wallet?"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-03": {
    puzzleId: "medium-03",
    keyframes: buildKeyframes([
      kf("medium03", {
        kind: "sequence",
        values: [2, 4, 8, 16, "?"],
        jumpLabel: "×2",
      }),
      kf("medium03", {
        kind: "sequence",
        values: [2, 4, 8, 16, "?"],
        highlightIndex: 3,
        jumpLabel: "×2",
      }),
      kf("medium03", {
        kind: "equation",
        lines: ["Each step doubles", "Apply ×2 for the next"],
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
        count: 20,
        maxVisible: 10,
      }),
      kf("medium04", {
        kind: "grid",
        rows: 4,
        cols: 5,
        filled: 20,
      }),
      kf("medium04", {
        kind: "equation",
        lines: ["Total ÷ equal groups", "Same count in each team"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-05": {
    puzzleId: "medium-05",
    keyframes: buildKeyframes([
      kf("medium05", { kind: "grid", rows: 2, cols: 4, filled: 8 }),
      kf("medium05", { kind: "items", emoji: "🔵", count: 3 }),
      kf("medium05", {
        kind: "equation",
        lines: ["Grid count + extras", "Two steps: multiply, then add"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-06": {
    puzzleId: "medium-06",
    keyframes: buildKeyframes([
      kf("medium06", {
        kind: "equation",
        lines: ["Tens place + ones place", "Build each digit from clues"],
      }),
      kf("medium06", {
        kind: "sequence",
        values: [3, 6],
        highlightIndex: 1,
      }),
      kf("medium06", {
        kind: "equation",
        lines: ["Tens digit · ones digit", "Put them side by side"],
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
          { count: 2, color: "#FF6B6B" },
          { count: 1, color: "#4ECDC4" },
        ],
      }),
      kf("hard01", {
        kind: "compare",
        left: { emoji: "🍕", count: 2, label: "eaten" },
        right: { emoji: "🍕", count: 1, label: "more" },
        operator: "+",
      }),
      kf("hard01", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 5,
        emoji: "🍕",
      }),
      kf("hard01", {
        kind: "equation",
        lines: [
          "Part ÷ whole = fraction",
          "Shaded slices ÷ total slices",
        ],
        highlightLine: 1,
      }),
    ]),
  },
  "hard-02": {
    puzzleId: "hard-02",
    keyframes: buildKeyframes([
      kf("hard02", {
        kind: "compare",
        left: { emoji: "🚂", count: 40, label: "mi" },
        right: { emoji: "⏱️", count: 4, label: "hr" },
        operator: "÷",
      }),
      kf("hard02", {
        kind: "equation",
        lines: ["Distance ÷ time = speed", "Find miles (or km) per hour"],
        highlightLine: 0,
      }),
      kf("hard02", {
        kind: "equation",
        lines: ["Speed × new hours", "How far in that time?"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-03": {
    puzzleId: "hard-03",
    keyframes: buildKeyframes([
      kf("hard03", {
        kind: "equation",
        lines: ["Start with the whole price"],
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["Percent = part of 100", "Find that part of the price"],
        highlightLine: 0,
      }),
      kf("hard03", {
        kind: "sequence",
        values: [5, 5, 5, 5],
        highlightIndex: 0,
        jumpLabel: "÷ 4",
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["One quarter of the price", "That piece is the markup"],
        highlightLine: 0,
      }),
      kf("hard03", {
        kind: "compare",
        left: { emoji: "🏷️", count: 20 },
        right: { emoji: "📈", count: 5 },
        operator: "+",
      }),
      kf("hard03", {
        kind: "equation",
        lines: ["Original + markup", "New price — your turn!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-04": {
    puzzleId: "hard-04",
    keyframes: buildKeyframes([
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, "?"],
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, "?"],
        addendIndices: [0, 1],
        highlightIndex: 2,
        jumpLabel: "+",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, "?"],
        addendIndices: [2, 3],
        highlightIndex: 4,
        jumpLabel: "+",
      }),
      kf("hard04", {
        kind: "sequence",
        values: [1, 1, 2, 3, 5, "?"],
        addendIndices: [3, 4],
        highlightIndex: 5,
        jumpLabel: "+",
      }),
      kf("hard04", {
        kind: "equation",
        lines: ["Add the last two numbers", "That is the rule every time"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-05": {
    puzzleId: "hard-05",
    keyframes: buildKeyframes([
      kf("hard05", {
        kind: "grid",
        rows: 3,
        cols: 5,
        filled: 15,
        emoji: "🍪",
      }),
      kf("hard05", {
        kind: "items",
        emoji: "🍪",
        count: 15,
        removed: 4,
      }),
      kf("hard05", {
        kind: "items",
        emoji: "🍪",
        count: 15,
        removed: 9,
      }),
      kf("hard05", {
        kind: "equation",
        lines: ["Subtract once, then again", "Take each loss from what is left"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-06": {
    puzzleId: "hard-06",
    keyframes: buildKeyframes([
      kf("hard06", { kind: "items", emoji: "🍎", count: 7 }),
      kf("hard06", {
        kind: "groups",
        emoji: "🍎",
        groups: [
          { count: 2, color: "#FF6B6B" },
          { count: 2, color: "#4ECDC4" },
          { count: 2, color: "#F7B731" },
        ],
      }),
      kf("hard06", {
        kind: "equation",
        lines: ["Deal round by round", "Per person + any left over"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-09": {
    puzzleId: "easy-09",
    keyframes: buildKeyframes([
      kf("easy09", {
        kind: "sequence",
        values: [1, 2, 3, 4],
        jumpLabel: "+",
      }),
      kf("easy09", {
        kind: "equation",
        lines: ["Adding numbers → total grows", "Keep joining amounts"],
        highlightLine: 0,
      }),
      kf("easy09", {
        kind: "equation",
        lines: ["Multiply with 0 anywhere", "The product stays 0"],
        highlightLine: 0,
      }),
      kf("easy09", {
        kind: "compare",
        left: { emoji: "➕", count: 5, label: "sum" },
        right: { emoji: "✖️", count: 0, label: "×0" },
        operator: "+",
      }),
    ]),
  },
  "easy-10": {
    puzzleId: "easy-10",
    keyframes: buildKeyframes([
      kf("easy10", {
        kind: "equation",
        lines: ["a × big", "a × small"],
      }),
      kf("easy10", {
        kind: "equation",
        lines: ["Same a twice!", "a × (big − small)"],
        highlightLine: 1,
      }),
      kf("easy10", {
        kind: "equation",
        lines: ["Factor out the shared number", "Then multiply what is left"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-07": {
    puzzleId: "medium-07",
    keyframes: buildKeyframes([
      kf("medium07", {
        kind: "equation",
        lines: ["Start number → goal 🎯"],
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["Try ÷ to make smaller", "Or × to make bigger"],
        highlightLine: 0,
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["Check after each step", "Are you closer to the goal?"],
        highlightLine: 0,
      }),
      kf("medium07", {
        kind: "equation",
        lines: ["Chain operators in order", "Build your path on the nut!"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-08": {
    puzzleId: "medium-08",
    keyframes: buildKeyframes([
      kf("medium08", {
        kind: "sequence",
        values: [0, 1, 2, 3, 4],
        jumpLabel: "+",
      }),
      kf("medium08", {
        kind: "equation",
        lines: ["Adding a list → one total", "Each number joins the sum"],
        highlightLine: 0,
      }),
      kf("medium08", {
        kind: "equation",
        lines: ["One zero in ×", "Whole product becomes 0"],
        highlightLine: 0,
      }),
      kf("medium08", {
        kind: "compare",
        left: { emoji: "➕", count: 4, label: "sum" },
        right: { emoji: "✖️", count: 0, label: "×0" },
        operator: "+",
      }),
    ]),
  },
  "hard-07": {
    puzzleId: "hard-07",
    keyframes: buildKeyframes([
      kf("hard07", {
        kind: "equation",
        lines: ["Numbers + operators", "One target to hit"],
        highlightLine: 0,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["× and ÷ first!", "Before + and −"],
        highlightLine: 0,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["Do tight groups first", "Then combine what is left"],
        highlightLine: 0,
      }),
      kf("hard07", {
        kind: "equation",
        lines: ["Order matters!", "Try it on your numbers"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-08": {
    puzzleId: "hard-08",
    keyframes: buildKeyframes([
      kf("hard08", {
        kind: "equation",
        lines: ["Start → goal 🎯"],
      }),
      kf("hard08", {
        kind: "equation",
        lines: ["Pick one operator per step", "Does it help reach the goal?"],
        highlightLine: 0,
      }),
      kf("hard08", {
        kind: "equation",
        lines: ["Link steps in a row", "Plan before you tap!"],
        highlightLine: 0,
      }),
    ]),
  },
  "easy-11": {
    puzzleId: "easy-11",
    keyframes: buildKeyframes([
      kf("easy11", {
        kind: "grid",
        rows: 2,
        cols: 3,
        filled: 0,
        emoji: "🍕",
      }),
      kf("easy11", {
        kind: "grid",
        rows: 2,
        cols: 3,
        filled: 2,
        emoji: "🍕",
      }),
      kf("easy11", {
        kind: "equation",
        lines: ["Equal slices first", "Shaded ÷ total = fraction"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-09": {
    puzzleId: "medium-09",
    keyframes: buildKeyframes([
      kf("medium09", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 0,
        emoji: "🍕",
      }),
      kf("medium09", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 3,
        emoji: "🍕",
      }),
      kf("medium09", {
        kind: "equation",
        lines: ["Every slice same size", "Count shaded, count all"],
        highlightLine: 1,
      }),
    ]),
  },
  "hard-09": {
    puzzleId: "hard-09",
    keyframes: buildKeyframes([
      kf("hard09", {
        kind: "grid",
        rows: 2,
        cols: 5,
        filled: 0,
        emoji: "🍕",
      }),
      kf("hard09", {
        kind: "grid",
        rows: 2,
        cols: 5,
        filled: 4,
        emoji: "🍕",
      }),
      kf("hard09", {
        kind: "equation",
        lines: ["More pieces, same whole", "Shaded ÷ total pieces"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-12": {
    puzzleId: "easy-12",
    keyframes: buildKeyframes([
      kf("easy12", {
        kind: "equation",
        lines: ["Statement says an answer", "Do not trust it yet"],
        highlightLine: 0,
      }),
      kf("easy12", {
        kind: "equation",
        lines: ["Calculate yourself", "? × ? = ?"],
        highlightLine: 0,
      }),
      kf("easy12", {
        kind: "equation",
        lines: ["Compare your result", "True only if they match!"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-13": {
    puzzleId: "easy-13",
    keyframes: buildKeyframes([
      kf("easy13", {
        kind: "equation",
        lines: ["Left side ↔ right side", "Must be equal when balanced"],
      }),
      kf("easy13", {
        kind: "equation",
        lines: ["Find the missing piece", "? makes both sides match"],
        highlightLine: 1,
      }),
    ]),
  },
  "easy-14": {
    puzzleId: "easy-14",
    keyframes: buildKeyframes([
      kf("easy14", {
        kind: "numberline",
        min: 0,
        max: 15,
        markers: [6],
        highlight: 6,
      }),
      kf("easy14", {
        kind: "numberline",
        min: 0,
        max: 15,
        markers: [6, 9],
        highlight: 9,
      }),
      kf("easy14", {
        kind: "equation",
        lines: ["+ jumps right", "− jumps left — count each step"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-10": {
    puzzleId: "medium-10",
    keyframes: buildKeyframes([
      kf("medium10", {
        kind: "sequence",
        values: [2, 5, 8, 1],
      }),
      kf("medium10", {
        kind: "sequence",
        values: [2, 5, 8, 1],
        addendIndices: [0, 1],
      }),
      kf("medium10", {
        kind: "equation",
        lines: ["Pick two numbers", "Do they add to the target?"],
        highlightLine: 1,
      }),
    ]),
  },
  "medium-11": {
    puzzleId: "medium-11",
    keyframes: buildKeyframes([
      kf("medium11", {
        kind: "equation",
        lines: ["Someone wrote an answer", "Does it look right?"],
        highlightLine: 0,
      }),
      kf("medium11", {
        kind: "equation",
        lines: ["Count back from the big number", "Or check with addition"],
        highlightLine: 0,
      }),
    ]),
  },
  "medium-12": {
    puzzleId: "medium-12",
    keyframes: buildKeyframes([
      kf("medium12", {
        kind: "equation",
        lines: ["31 ≈ nearest ten", "Round to make it easy"],
        highlightLine: 0,
      }),
      kf("medium12", {
        kind: "equation",
        lines: ["58 ≈ nearest ten", "Round both numbers"],
        highlightLine: 0,
      }),
      kf("medium12", {
        kind: "equation",
        lines: ["Add the rounded numbers", "Pick the closest choice!"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-10": {
    puzzleId: "hard-10",
    keyframes: buildKeyframes([
      kf("hard10", {
        kind: "items",
        emoji: "🍪",
        count: 7,
        maxVisible: 7,
      }),
      kf("hard10", {
        kind: "groups",
        emoji: "🍪",
        groups: [
          { count: 2, color: "#FF6B6B" },
          { count: 2, color: "#4ECDC4" },
          { count: 2, color: "#F7B731" },
        ],
      }),
      kf("hard10", {
        kind: "equation",
        lines: ["Deal one round at a time", "Per person + leftovers"],
        highlightLine: 0,
      }),
    ]),
  },
  "hard-11": {
    puzzleId: "hard-11",
    keyframes: buildKeyframes([
      kf("hard11", {
        kind: "grid",
        rows: 1,
        cols: 2,
        filled: 1,
        emoji: "🍕",
      }),
      kf("hard11", {
        kind: "grid",
        rows: 2,
        cols: 4,
        filled: 4,
        emoji: "🍕",
      }),
      kf("hard11", {
        kind: "equation",
        lines: ["Same area, more slices", "Which fraction matches?"],
        highlightLine: 0,
      }),
    ]),
  },
};
