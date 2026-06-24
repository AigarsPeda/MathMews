export type VisualScene =
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
      kind: "sequence";
      values: (number | "?" | null)[];
      highlightIndex?: number;
      jumpLabel?: string;
    }
  | {
      kind: "grid";
      rows: number;
      cols: number;
      filled: number;
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
  keyframes: VisualKeyframe[];
};
