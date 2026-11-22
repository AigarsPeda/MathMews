import type { Puzzle } from '@/types/puzzle';
import { validFractionStrip, type FractionStripState } from '@/utils/fraction-models';

export type FractionDiagram = {
  numerator: number;
  denominator: number;
  shape: 'pie' | 'grid' | 'strip' | 'set';
  selected?: readonly number[];
  groupSize?: number;
  equivalents?: string[];
};

export type FractionRevealPlan = { diagrams: FractionDiagram[]; equation?: string };
type Parts = Pick<FractionDiagram, 'numerator' | 'denominator'>;

function diagram({ numerator, denominator }: Parts, shape: FractionDiagram['shape'] = 'strip'): FractionDiagram {
  return { numerator, denominator, shape };
}
const fraction = (part: Parts) => `${part.numerator}/${part.denominator}`;

function compare(a: FractionDiagram, b: FractionDiagram): FractionRevealPlan {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return { diagrams: [a, b], equation: `${fraction(a)} ${difference === 0 ? '=' : difference < 0 ? '<' : '>'} ${fraction(b)}` };
}

function fromChoice(text: string) {
  if (!/^\d+\/[1-9]\d*$/.test(text)) return null;
  const [numerator, denominator] = text.split('/').map(Number);
  return numerator <= denominator ? diagram({ numerator, denominator }) : null;
}

export function fractionRevealPlan(puzzle: Puzzle, strip: FractionStripState | null = null, selected: readonly number[] = []): FractionRevealPlan | null {
  switch (puzzle.type) {
    case 'fraction_build':
      return { diagrams: [{ ...diagram(puzzle.payload, 'pie'), selected: selected.length === puzzle.payload.numerator ? selected : undefined }] };
    case 'fraction_match': {
      const pairs = puzzle.response ? puzzle.payload.pairs.slice(0, 1) : puzzle.payload.pairs;
      return { diagrams: pairs.map(pair => diagram(pair, pair.visual ?? 'pie')) };
    }
    case 'fraction_equivalent': {
      const answer = fromChoice(puzzle.payload.choices[puzzle.correctIndex]);
      return answer && compare(diagram(puzzle.payload), answer);
    }
    case 'compare': {
      const a = fromChoice(puzzle.payload.optionA), b = fromChoice(puzzle.payload.optionB);
      return a && b && compare(a, b);
    }
    case 'fraction_strip': {
      const target = diagram(puzzle.payload);
      if (strip && validFractionStrip(puzzle, strip) && strip.parts !== target.denominator) {
        return compare(target, diagram({ numerator: strip.shaded!, denominator: strip.parts }));
      }
      return { diagrams: [target] };
    }
    case 'sort_buckets': {
      const board = puzzle.payload;
      if (board.rule !== 'fractions') return null;
      return { diagrams: board.targets.map(([numerator, denominator]) => ({
        ...diagram({ numerator, denominator }),
        equivalents: [...new Set(board.fractions.filter(([n,d]) => n * denominator === numerator * d)
          .map(pair => pair.join('/')))].filter(value => value !== `${numerator}/${denominator}`),
      })) };
    }
    default: {
      const example = puzzle.fractionExample;
      if (!example) return null;
      if (example.compareTo) {
        const [numerator, denominator] = example.compareTo;
        return compare(diagram(example), diagram({ numerator, denominator }));
      }
      if (example.whole) {
        const groupSize = example.whole / example.denominator;
        return { diagrams: [{ ...diagram(example, 'set'), groupSize }],
          equation: `${fraction(example)} × ${example.whole} = ${example.numerator * groupSize}` };
      }
      return { diagrams: [diagram(example, 'pie')] };
    }
  }
}
