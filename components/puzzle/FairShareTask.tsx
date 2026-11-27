import type { ComponentType, ReactNode } from 'react';
import type { FairSharePuzzle } from '@/types/puzzle';
import { SharingTable } from './counting/SharingTable';
import { ShareProof } from './counting/ShareProof';

type FairShareTaskProps = {
  puzzle: FairSharePuzzle;
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onUseHelp?: () => void;
  initialDistribution?: readonly number[];
  playbackOwnsControls?: boolean;
  checkedModel?: ReactNode;
  checkedResult?: 'correct' | 'wrong';
  onSelect: (index: number) => void;
  onDistributionChange?: (locations: number[]) => void;
};

export function FairShareTask({ puzzle, answered, initialDistribution, playbackOwnsControls, checkedModel, checkedResult, onDistributionChange }: FairShareTaskProps) {
  const {items, people, object} = puzzle.payload;
  return checkedModel ?? <SharingTable key={puzzle.id} items={items} groups={people} object={object} initialLocations={initialDistribution}
    disabled={answered || playbackOwnsControls || !!checkedResult} onDistributionChange={onDistributionChange} />;
}

export function FairShareReveal({puzzle, distribution, mode = 'worked', onSolutionShown}: {
  puzzle: FairSharePuzzle; selectedIndex?: number | null; distribution?: readonly number[]; mode?: 'attempt' | 'worked'; onSolutionShown?: () => void;
}) {
  const {items, people, object} = puzzle.payload;
  return <ShareProof items={items} groups={people} object={object} initialLocations={distribution} attempt={mode === 'attempt'} onSolutionShown={onSolutionShown} />;
}
