import type { ComparePuzzle, EquationBoardPuzzle, FunctionMachinePuzzle, PairSumPuzzle, TrueFalsePuzzle } from '@/types/puzzle';
import { HelpBalanceProof } from './HelpBalanceProof';
import { HelpCheckProof } from './HelpCheckProof';
import { HelpCompareProof } from './HelpCompareProof';
import { HelpMachineProof } from './HelpMachineProof';
import { HelpTargetProof } from './HelpTargetProof';

export type HelpWorkedPuzzle = ComparePuzzle | EquationBoardPuzzle | FunctionMachinePuzzle | PairSumPuzzle | TrueFalsePuzzle;

/** The help-only worked proofs: one shared example per kind of maths, drawn for a child reading the sheet. Play never mounts these. */
export function isHelpWorkedPuzzle(puzzle: { type?: string }): puzzle is HelpWorkedPuzzle {
  return puzzle.type === 'compare' || puzzle.type === 'equation_board' || puzzle.type === 'function_machine' || puzzle.type === 'pair_sum' || puzzle.type === 'true_false';
}

export function HelpWorkedProof({ puzzle, onSolutionShown }: { puzzle: HelpWorkedPuzzle; onSolutionShown: () => void }) {
  switch (puzzle.type) {
    case 'compare': return <HelpCompareProof puzzle={puzzle} onSolutionShown={onSolutionShown} />;
    case 'equation_board': return <HelpBalanceProof puzzle={puzzle} onSolutionShown={onSolutionShown} />;
    case 'function_machine': return <HelpMachineProof puzzle={puzzle} onSolutionShown={onSolutionShown} />;
    case 'pair_sum': return <HelpTargetProof puzzle={puzzle} onSolutionShown={onSolutionShown} />;
    case 'true_false': return <HelpCheckProof puzzle={puzzle} onSolutionShown={onSolutionShown} />;
  }
}
