import { Canvas, Group, RoundedRect, useCanvasRef } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import type { PuzzleObject } from '@/types/puzzle-object';
import { DiagramGlyph } from '../kit/DiagramIcon';
import { IdleHint } from '../kit/PracticeAffordances';
import { landTick } from '../kit/proofHaptics';
import type { RevealBeats } from '../kit/useRevealBeats';
import { QuantityEntryBuild, useFirstQuantityEncounter } from './QuantityPractice';
import { QuantityStage } from './QuantityStage';
import { useModelPaint } from './useModelPaint';

function PairSpot({x, y, size, index, progress}: {x: number; y: number; size: number; index: number; progress: SharedValue<number>}) {
  const opacity = useDerivedValue(() => Math.max(0, 1 - Math.abs(progress.value - index - .6) * 1.6));
  return <RoundedRect {...{x, y}} width={size} height={size} r={10} color={Quantity.teal.light} opacity={opacity} />;
}

export function CompareTrays({counts, object, selected, onSelect, beats, worked = false}: {
  counts: number[]; object: PuzzleObject; selected: number | null; onSelect?: (i: number) => void; beats?: RevealBeats; worked?: boolean;
}) {
  const {t} = useTranslation();
  const screen = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [touched, touch] = useState(false);
  const first = useFirstQuantityEncounter('compare', !!onSelect);
  const available = width || screen.width - 52;
  const max = Math.max(...counts), pairs = Math.min(...counts);
  const columns = Math.max(1, Math.min(max, max > 5 && max <= 10 ? Math.ceil(max / 2) : max, Math.floor((available - 12) / 43)));
  const pitch = Math.min(68, Math.floor((available - 12) / columns));
  const pieceSize = pitch - Shape.space.loose;
  const trayWidth = columns * pitch + 12, heights = counts.map(n => 12 + pitch * Math.ceil(n / columns));
  const gap = 10, height = heights[0] + gap + heights[1];
  const canvas = useCanvasRef();
  useModelPaint(!!width, beats, canvas);
  const idle = useSharedValue(0);
  const drawing = <Canvas ref={canvas} style={{width: trayWidth, height}} accessible={false}>
    {counts.map((n, tray) => {
      const chosen = selected === tray;
      return <Group key={tray} transform={[{translateY: tray ? heights[0] + gap : 0}]}>
        <RoundedRect x={0} y={0} width={trayWidth} height={heights[tray]} r={16} color={chosen ? Quantity.violet.light : Ink.tray} />
        {worked && beats?.settled && n > pairs && Array.from({length: Math.ceil(n / columns)}, (_, r) => {
          const start = Math.max(pairs, r * columns), end = Math.min(n, (r + 1) * columns);
          return end > start && <RoundedRect key={r} x={6 + start % columns * pitch} y={6 + r * pitch} width={(end - start) * pitch} height={pitch} r={12} color={Quantity.amber.light} />;
        })}
        {Array.from({length: n}, (_, i) => <Group key={i} transform={[{translateX: 6 + i % columns * pitch}, {translateY: 6 + Math.floor(i / columns) * pitch}]}>
          {worked && i < pairs && <PairSpot x={0} y={0} size={pitch} index={i} progress={beats?.position ?? idle} />}
          <Group transform={[{translateX: Shape.space.loose / 2}, {translateY: Shape.space.loose / 2}, {scale: pieceSize / 64}]}>
            <DiagramGlyph name={object} displaySize={pieceSize} />
          </Group>
        </Group>)}
      </Group>;
    })}
  </Canvas>;
  const label = (n: number) => `${n} ${t('taskObjects.' + object)}`;
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <QuantityStage model="compare" locked={!onSelect}><View nativeID={beats ? 'play-proof-model' : undefined} testID={beats ? 'play-proof-model' : 'play-entry-model'} accessible={!!beats} accessibilityRole={beats ? 'image' : undefined}
      accessibilityLabel={beats ? counts.map(label).join(', ') : undefined} style={{width: trayWidth, height, alignSelf: 'center'}}>
      <QuantityEntryBuild editing={!!onSelect} ready={width > 0}>{drawing}</QuantityEntryBuild>
      {onSelect && counts.map((n, tray) => <Pressable key={tray} accessibilityRole="button" accessibilityLabel={label(n)} accessibilityState={{selected: selected === tray}}
        onPressIn={() => touch(true)} onPress={() => {landTick(); onSelect(tray);}} style={[StyleSheet.absoluteFill, {top: tray ? heights[0] + gap : 0, height: heights[tray]}]} />)}
      {onSelect && <IdleHint movable={!!onSelect} firstEncounter={first} interacted={touched || selected != null} from={{x: 16, y: heights[0] / 2}} to={{x: 16, y: heights[0] + gap + heights[1] / 2}} />}
    </View></QuantityStage>
  </View>;
}
