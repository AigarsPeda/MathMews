import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useFirstQuantityEncounter } from './counting/QuantityPractice';
import { IdleHint } from './kit/PracticeAffordances';

/** The gesture follows the edge of the control group, independent of the proposed answer. */
export function ClockResponseHint({ kind, interacted }: { kind: 'read' | 'judge' | 'write'; interacted: boolean }) {
  const [width, setWidth] = useState(0);
  const [used, setUsed] = useState(false);
  if (interacted && !used) setUsed(true);
  const firstEncounter = useFirstQuantityEncounter(`clock-${kind}`, !interacted);
  const reduced = useReducedMotion();
  const y = kind === 'write' ? 0 : -22;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={StyleSheet.absoluteFill} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 && !used && <IdleHint movable firstEncounter={firstEncounter} interacted={interacted}
      from={{ x: firstEncounter && !reduced ? 20 : width / 2, y }} to={{ x: width - 20, y }} />}
  </View>;
}
