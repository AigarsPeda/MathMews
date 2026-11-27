import type { Puzzle } from '@/types/puzzle';
import { buildFractionMatchCards, type FractionMatchCard } from '@/utils/fraction-match';
import { validFractionStrip, type FractionStripState } from '@/utils/fraction-models';

export type FractionDiagram = {
  numerator: number;
  denominator: number;
  shape: 'pie' | 'grid' | 'strip' | 'set';
  selected?: readonly number[];
  targetCount?: number;
  groupSize?: number;
  unit?: 'seedlings' | 'spaces';
  equivalents?: string[];
};

export type FractionRevealPlan = { mechanic?: 'wedges' | 'equivalent' | 'halves'; submitted?: number; submittedFraction?: Parts; diagrams: FractionDiagram[]; equation?: string; matchCards?: FractionMatchCard[]; matchedIds?: readonly string[] };
type Parts = Pick<FractionDiagram, 'numerator' | 'denominator'>;

function diagram({ numerator, denominator }: Parts, shape: FractionDiagram['shape'] = 'strip'): FractionDiagram {
  return { numerator, denominator, shape };
}
const fraction = (part: Parts) => `${part.numerator}/${part.denominator}`;

function compare(a: FractionDiagram, b: FractionDiagram): FractionRevealPlan {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return { diagrams: [a, b], equation: `${fraction(a)} ${difference === 0 ? '=' : difference < 0 ? '<' : '>'} ${fraction(b)}` };
}

function fromChoice(text: string, allowImproper = false) {
  if (!/^\d+\/[1-9]\d*$/.test(text)) return null;
  const [numerator, denominator] = text.split('/').map(Number);
  return allowImproper || numerator <= denominator ? diagram({ numerator, denominator }) : null;
}

export function fractionRevealPlan(puzzle: Puzzle, strip: FractionStripState | null = null, selected?: readonly number[], mode: 'attempt' | 'worked' = 'worked', matchedIds?: readonly string[], selectedByPair?: readonly (readonly number[])[], choiceIndex?: number): FractionRevealPlan | null {
  switch (puzzle.type) {
    case 'fraction_build':
      return { mechanic: 'wedges', diagrams: [{ ...diagram(puzzle.payload, 'pie'), targetCount: puzzle.payload.numerator,
        numerator: selected && (mode === 'attempt' || selected.length === puzzle.payload.numerator) ? selected.length : puzzle.payload.numerator,
        selected: selected && (mode === 'attempt' || selected.length === puzzle.payload.numerator) ? selected : undefined }] };
    case 'fraction_match': {
      if (puzzle.response) return { diagrams: [diagram(puzzle.payload.pairs[0], 'pie')] };
      if (selectedByPair) return { mechanic: 'wedges', diagrams: puzzle.payload.pairs.map((pair, i) => ({
        ...diagram(pair, 'pie'), selected: selectedByPair[i] ?? [], targetCount: pair.numerator,
      })) };
      const matchCards = buildFractionMatchCards(puzzle);
      const visuals = matchCards.filter(card => card.kind === 'visual');
      return { matchCards, matchedIds, diagrams: visuals.map(card => ({ ...diagram(card, 'pie'),
        selected: Array.from({ length: card.numerator }, (_, index) => index),
      })) };
    }
    case 'fraction_equivalent': {
      const answer = fromChoice(puzzle.payload.choices[puzzle.correctIndex]);
      if (!answer) return null;
      const choice = choiceIndex === undefined ? null : fromChoice(puzzle.payload.choices[choiceIndex] ?? '', true);
      const submitted = choice ? choice.numerator * answer.denominator / choice.denominator : undefined;
      return { ...compare(diagram(puzzle.payload), answer), mechanic: 'equivalent', submitted, submittedFraction: choice ?? undefined };
    }
    case 'compare': {
      const a = fromChoice(puzzle.payload.optionA), b = fromChoice(puzzle.payload.optionB);
      return a && b && compare(a, b);
    }
    case 'fraction_strip': {
      const target = diagram(puzzle.payload);
      if (mode === 'attempt' && strip && strip.shaded !== null) {
        const checked = { ...diagram({ numerator: strip.shaded, denominator: strip.parts }), selected: strip.selected };
        return puzzle.payload.mode === 'equivalent' ? compare(target, checked) : { diagrams: [checked] };
      }
      if (puzzle.payload.mode === 'equivalent') {
        if (strip && validFractionStrip(puzzle, strip)) {
          return compare(target, { ...diagram({ numerator: strip.shaded!, denominator: strip.parts }), selected: strip.selected });
        }
        const parts = puzzle.payload.partitions.filter(parts => (target.numerator * parts) % target.denominator === 0);
        const worked = strip && parts.includes(strip.parts) ? strip.parts
          : parts.find(parts => parts !== target.denominator) ?? parts[0];
        if (worked !== undefined) {
          return compare(target, diagram({ numerator: target.numerator * worked / target.denominator, denominator: worked }));
        }
      }
      if (strip && validFractionStrip(puzzle, strip)) {
        return { diagrams: [{ ...diagram({ numerator: strip.shaded!, denominator: strip.parts }), selected: strip.selected }] };
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
        const unit = puzzle.contextObjects?.some(({ object }) => object === 'planting_tile') ? 'spaces'
          : puzzle.contextObjects?.some(({ object }) => object === 'plant') ? 'seedlings' : undefined;
        return { diagrams: [{ ...diagram(example, 'set'), groupSize, unit }],
          equation: `${example.numerator} × ${groupSize} = ${example.numerator * groupSize}` };
      }
      if (example.numerator === 2 && example.denominator === 2) {
        const submitted = choiceIndex !== undefined && 'choices' in puzzle ? Number(puzzle.choices[choiceIndex]) : 2;
        const count = Number.isFinite(submitted) ? submitted : 2;
        return { mechanic: 'halves', submitted: count, diagrams: [{ ...diagram(example, 'pie'),
          selected: Array.from({ length: Math.max(0, Math.min(2, count)) }, (_, i) => i) }] };
      }
      return { diagrams: [diagram(example, 'pie')] };
    }
  }
}


export function fractionRevealBeatCount(diagrams: readonly FractionDiagram[], aligned: boolean) {
  if (aligned) {
    // Each aligned landing must be a whole number of pieces on both strips.
    const [first, second] = diagrams;
    let beats = Math.min(7, first.numerator, second.numerator);
    while (beats > 1 && (first.numerator % beats || second.numerator % beats)) beats--;
    return Math.max(1, beats);
  }
  return Math.min(7, Math.max(1, ...diagrams.map(part => part.numerator)));
}
