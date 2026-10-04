import { applyMathOperator } from "@/utils/puzzle-math";
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

export function getVisualExplanation(puzzle: Puzzle): VisualExplanation {
  let scene: VisualScene = { kind: "equation", lines: [puzzle.question] };
  let worked: VisualScene = { kind: "equation", lines: [puzzle.explanation] };
  switch (puzzle.type) {
    case "target_build": {
      const expression = puzzle.payload.numbers.map((number, i) => `${number}${puzzle.payload.solution[i] ? ` ${puzzle.payload.solution[i]} ` : ""}`).join("");
      scene = { kind: "equation", lines: [puzzle.payload.numbers.join("  ?  "), `= ${puzzle.payload.target}`] };
      worked = { kind: "equation", lines: [`${expression} = ${puzzle.payload.target}`, puzzle.explanation] };
      break;
    }
    case "operation_path": {
      let value = puzzle.payload.start;
      const lines = puzzle.payload.steps.map(step => { const before = value; value = applyMathOperator(value, step.operand, step.operator)!; return `${before} ${step.operator} ${step.operand} = ${value}`; });
      worked = { kind: "equation", lines };
      break;
    }
    case "fraction_build":
    case "fraction_equivalent": {
      const { numerator, denominator } = puzzle.payload;
      scene = { kind: "fraction", numerator: 0, denominator };
      worked = { kind: "fraction", numerator, denominator };
      break;
    }
    case "number_line": {
      const { min, max, start, correctValue } = puzzle.payload;
      scene = { kind: "numberline", min, max, markers: [start], highlight: start };
      worked = { kind: "numberline", min, max, markers: [...new Set([start, correctValue])], highlight: correctValue };
      break;
    }
    case "order_numbers":
      scene = { kind: "sequence", values: puzzle.payload.numbers };
      worked = { kind: "sequence", values: puzzle.payload.correctOrder };
      break;
    case "pattern_next":
      scene = { kind: "sequence", values: [...puzzle.payload.sequence, "?"] };
      worked = { kind: "sequence", values: [...puzzle.payload.sequence, Number(puzzle.payload.choices[puzzle.correctIndex])] };
      break;
    case "pair_sum": {
      const { numbers, correctIndices, target } = puzzle.payload;
      scene = { kind: "sequence", values: numbers };
      worked = { kind: "equation", lines: [`${numbers[correctIndices[0]]} + ${numbers[correctIndices[1]]} = ${target}`] };
      break;
    }
    case "balance":
      scene = { kind: "equation", lines: [`${puzzle.payload.leftDisplay} = ${puzzle.payload.rightValue}`] };
      worked = { kind: "equation", lines: [`${puzzle.payload.leftDisplay.replace("?", puzzle.payload.choices[puzzle.correctIndex])} = ${puzzle.payload.rightValue}`, puzzle.explanation] };
      break;
    case "function_machine":
      scene = { kind: "sequence", values: [puzzle.payload.input, "?", puzzle.payload.output] };
      worked = { kind: "equation", lines: [`${puzzle.payload.input} → ${puzzle.payload.choices[puzzle.correctIndex]} → ${puzzle.payload.output}`] };
      break;
    case "compare":
      scene = { kind: "equation", lines: [puzzle.payload.optionA, puzzle.payload.optionB] };
      break;
    case "fix_mistake":
      scene = { kind: "equation", lines: puzzle.payload.wrongWork };
      worked = { kind: "equation", lines: [puzzle.payload.choices[puzzle.correctIndex], puzzle.explanation] };
      break;
    case "estimate":
      scene = { kind: "equation", lines: [puzzle.payload.expression] };
      worked = { kind: "equation", lines: [puzzle.payload.choices[puzzle.correctIndex], puzzle.explanation] };
      break;
    case "fraction_match":
      scene = { kind: "fraction", ...puzzle.payload.pairs[0] };
      worked = { kind: "equation", lines: puzzle.payload.pairs.map(pair => `${pair.numerator}/${pair.denominator}`) };
      break;
    case "true_false":
      scene = { kind: "equation", lines: [puzzle.payload.statement] };
      break;
    case "fair_share": {
      const { items, people, emoji } = puzzle.payload;
      scene = { kind: "items", emoji, count: items };
      worked = { kind: "groups", emoji, groups: [...Array.from({ length: people }, () => ({ count: Math.floor(items / people), color: "#247A3C" })), ...(items % people ? [{ count: items % people, color: "#99501A" }] : [])] };
      break;
    }
  }
  if (puzzle.visualHelp) { scene = puzzle.visualHelp.scene; worked = puzzle.visualHelp.worked; }
  return { puzzleId: puzzle.id, keyframes: [
    { at: 0, captionKey: puzzle.question, scene },
    { at: 0.5, captionKey: puzzle.hint, scene: { kind: "equation", lines: [puzzle.hint] } },
    { at: 1, captionKey: puzzle.explanation, scene: worked },
  ] };
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
