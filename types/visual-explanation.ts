export type VisualScene =
  | { kind: "practice"; prompt: string; tokens: PracticeToken[]; result?: string }
  | { kind: "fraction"; numerator: number; denominator: number }
  | {
      kind: "items";
      emoji: string;
      count: number;
      removed?: number;
      maxVisible?: number;
    }
  | {
      kind: "groups";
      emoji: string;
      groups: { count: number; color: string }[];
    }
  | {
      kind: "numberline";
      min: number;
      max: number;
      markers: number[];
      highlight?: number;
    }
  | {
      kind: "numberline_jump";
      start: number;
      jump: number;
      moves: number;
    }
  | {
      kind: "sequence";
      values: (number | "?" | null)[];
      /** The two numbers being added together. */
      addendIndices?: [number, number];
      highlightIndex?: number;
      jumpLabel?: string;
    }
  | {
      kind: "grid";
      rows: number;
      cols: number;
      filled: number;
      emoji?: string;
    }
  | {
      kind: "equation";
      lines: string[];
      highlightLine?: number;
    }
  | {
      kind: "compare";
      left: { emoji: string; count: number; label?: string };
      right: { emoji: string; count: number; label?: string };
      operator: "+" | "−" | "×" | "÷";
      result?: number;
    };

export type VisualKeyframe = {
  at: number;
  captionKey: string;
  scene: VisualScene;
};

export type VisualExplanation = {
  puzzleId: string;
  titleKey: string;
  keyframes: VisualKeyframe[];
};

/** Positions on the practice board, in a 300 × 140 coordinate space. */
export type PracticeToken = {
  id: string;
  label: string;
  x: number;
  y: number;
  shape?: "tile" | "part" | "plain";
  tone?: "primary" | "secondary" | "muted";
  visible?: boolean;
  scale?: number;
  width?: number;
  /** Separate lanes keep swapping number tiles readable while they cross. */
  arc?: number;
};
