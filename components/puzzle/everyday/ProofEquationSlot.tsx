import type { ReactNode } from 'react';
import { View } from 'react-native';
import { PlayProofCaption } from '@/components/puzzle/PlayProofCaption';

/** Expose the equation to native measurement once the model has settled. */
export function ProofEquationSlot({ settled, children }: { settled: boolean; children: ReactNode }) {
  const id = settled ? 'play-proof-equation' : undefined;
  return (
    <PlayProofCaption>
      <View nativeID={id} testID={id}>{children}</View>
    </PlayProofCaption>
  );
}
