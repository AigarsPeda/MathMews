export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PuzzleTopic =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "logic"
  | "patterns";

export type Puzzle = {
  id: string;
  difficulty: PuzzleDifficulty;
  question: string;
  choices: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
  topic: PuzzleTopic;
  ageRange: [number, number];
};
