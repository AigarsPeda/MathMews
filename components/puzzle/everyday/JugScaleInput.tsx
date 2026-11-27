import { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { JugGrip } from './JugGrip';
import { capacityChoiceLevel, type CapacityInput, type CapacityModel } from '@/utils/puzzle-capacity';
import { IdleHint } from '../kit/PracticeAffordances';
import { landTick } from '../kit/proofHaptics';

let encountered = false;

/** The fixed waterline is the given. The movable gauge records the learner's estimate. */
export function JugScaleInput({ model, input, width, height, left, rim, scale, initial, description }: {
  model: CapacityModel; input: CapacityInput; width: number; height: number; left: number;
  rim: number; scale: number; initial: number; description: string;
}) {
  const { t } = useTranslation();
  const [first] = useState(() => !encountered);
  const [touched, setTouched] = useState(false);
  const options = input.choices.map((choice, index) => ({ level: capacityChoiceLevel(model, choice), index }))
    .filter((item): item is { level: number; index: number } => item.level !== undefined)
    .sort((a, b) => a.level - b.level);
  const selected = options.find(item => item.index === input.selectedIndex);
  const level = selected?.level ?? initial;
  const y = Math.max(0, Math.min(height, rim - level * scale));
  const x = width * .72;
  const activeIndex = useRef<number | null>(null);
  function choose(index: number) {
    encountered = true;
    setTouched(true);
    if (activeIndex.current === index || input.selectedIndex === index) return;
    activeIndex.current = index;
    input.onSelect(index);
    landTick();
  }
  function move(event: GestureResponderEvent) {
    if (!options.length) return;
    const at = (rim - event.nativeEvent.locationY) / scale;
    const nearest = options.reduce((best, option) => Math.abs(at - option.level) < Math.abs(at - best.level) ? option : best);
    choose(nearest.index);
  }
  function step(up: boolean) {
    activeIndex.current = null;
    const next = up ? options.find(item => item.level > level) : [...options].reverse().find(item => item.level < level);
    if (next) choose(next.index);
  }
  return <View testID="jug-scale-input" accessible accessibilityRole="adjustable" accessibilityLabel={description}
    accessibilityHint={t('everyday.traceJug')} accessibilityValue={selected ? { text: input.choices[selected.index] } : undefined}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'increment') step(true);
      if (event.nativeEvent.actionName === 'decrement') step(false);
    }}
    onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={event => { activeIndex.current = null; move(event); }} onResponderMove={move}
    onResponderRelease={() => { activeIndex.current = null; }} onResponderTerminate={() => { activeIndex.current = null; }}
    style={{ position: 'absolute', left, width, height, top: 0 }}>
    <JugGrip x={Math.max(22, Math.min(width - 22, x))} y={y} />
    <IdleHint movable firstEncounter={first} interacted={touched || selected !== undefined}
      from={{ x, y }} to={{ x, y: Math.max(12, y - Math.min(42, height / 4)) }} />
  </View>;
}
