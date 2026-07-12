import type { FractionMatchPuzzle } from "@/types/puzzle";

export type FractionMatchVisual = "pie" | "grid";

export type FractionMatchCard = {
  id: string;
  kind: "text" | "visual";
  numerator: number;
  denominator: number;
  visual: FractionMatchVisual;
};

export function getFractionGridSize(denominator: number): {
  cols: number;
  rows: number;
} {
  if (denominator === 9) return { cols: 3, rows: 3 };
  if (denominator === 6) return { cols: 3, rows: 2 };
  if (denominator === 8) return { cols: 4, rows: 2 };
  if (denominator === 5) return { cols: 5, rows: 1 };
  if (denominator === 4) return { cols: 2, rows: 2 };
  const cols = Math.ceil(Math.sqrt(denominator));
  const rows = Math.ceil(denominator / cols);
  return { cols, rows };
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function buildFractionMatchCards(
  puzzle: FractionMatchPuzzle,
): FractionMatchCard[] {
  const cards: FractionMatchCard[] = [];
  for (const pair of puzzle.payload.pairs) {
    const visual = pair.visual ?? "pie";
    cards.push({
      id: `${puzzle.id}-t-${pair.numerator}-${pair.denominator}`,
      kind: "text",
      numerator: pair.numerator,
      denominator: pair.denominator,
      visual,
    });
    cards.push({
      id: `${puzzle.id}-v-${pair.numerator}-${pair.denominator}`,
      kind: "visual",
      numerator: pair.numerator,
      denominator: pair.denominator,
      visual,
    });
  }

  const next = [...cards];
  let seed = hashSeed(puzzle.id);
  for (let i = next.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) | 0;
    const j = Math.abs(seed) % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function isFractionMatchPair(
  a: FractionMatchCard,
  b: FractionMatchCard,
): boolean {
  if (a.kind === b.kind) return false;
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function getFractionMatchCardCount(puzzle: FractionMatchPuzzle): number {
  return puzzle.payload.pairs.length * 2;
}
