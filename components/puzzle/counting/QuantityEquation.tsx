import { View } from 'react-native';
import { ProofCaption } from '../kit/Focus';

/** Measure the final, localized equation in place so wrapping cannot move the board. */
export function QuantityEquation({ text, settled }: { text: string; settled: boolean }) {
  const id = settled ? 'play-proof-equation' : undefined;
  return <View nativeID={id} testID={id} accessibilityElementsHidden={!settled}
    importantForAccessibility={settled ? 'auto' : 'no-hide-descendants'} style={{marginTop: 8, opacity: settled ? 1 : 0}}>
    <ProofCaption text={text} />
  </View>;
}
