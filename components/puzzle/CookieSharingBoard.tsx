import { ProofWindow } from './counting/ProofWindow';
import { canSnapshotCanvas, useModelPaint } from './counting/useModelPaint';
import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { useDerivedValue, useSharedValue, withTiming, withSequence, type SharedValue } from 'react-native-reanimated';
import { Canvas, Group, Oval, RoundedRect, useCanvasRef } from '@shopify/react-native-skia';
import { useContext, useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDealProgress } from './counting/useDealProgress';
import { Ink, proofTempo, ProofMotion, PuzzleColors, Shape } from '@/constants/puzzle-theme';
import { DiagramGlyph } from './kit/DiagramIcon';
import { ProofPlaybackContext } from './kit/ProofFeedback';
import { LandingFrame } from './counting/CountingLane';
import { SharingTable, sharingSlot, sharingTableLayout } from './counting/SharingTable';
import { ProofCaption } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';

export function CookieSharingBoard({ items, plates, disabled, initialDistribution, onDistributionChange }: {
  items: number; plates: number; disabled: boolean; initialDistribution?: readonly number[]; onUseHelp?: () => void; onDistributionChange?: (locations: number[]) => void;
}) {
  return <SharingTable items={items} groups={plates} initialLocations={initialDistribution} object="cookie" disabled={disabled} onDistributionChange={onDistributionChange} />;
}

type Point = { x: number; y: number };
function DealtCookie({ id, from, to, time, width, contact }: { contact: boolean; id: number; from: Point; to: Point; time: SharedValue<number>; width: number }) {
  const pulse = useSharedValue(0);
  const { onLanding, landingHaptics } = useContext(ProofPlaybackContext);
  useEffect(() => {
    if (!contact) { pulse.set(0); return; }
    pulse.set(withSequence(withTiming(1, {duration: ProofMotion.land / 2}), withTiming(0, {duration: ProofMotion.land / 2})));
  }, [contact, pulse]);
  useEffect(() => { if (contact && landingHaptics) onLanding?.(); }, [contact, landingHaptics, onLanding]);
  const transform = useDerivedValue(() => {
    const fraction = Math.min(1, Math.max(0, time.value - id));
    const arc = Math.sin(Math.PI * fraction);
    // Swing outside the supply column before descending past the next cookie.
    const side = to.x + 22 < width / 2 ? -1 : 1;
    const x = Math.max(0, Math.min(width - 44, from.x + (to.x - from.x) * fraction + side * 45 * arc));
    const y = from.y + (to.y - from.y) * fraction - 12 * arc;
    return [{ translateX: x + 4 }, { translateY: y + 4 + pulse.value }, { scaleX: (1 + .04 * pulse.value) * 36 / 64 }, { scaleY: (1 - .04 * pulse.value) * 36 / 64 }];
  });
  return <Group transform={transform}><DiagramGlyph name="cookie" displaySize={36} /></Group>;
}

export function CookieDeal({ items, plates, onSolutionShown }: { items: number; plates: number; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const screen = useWindowDimensions();
  const [measured, setWidth] = useState(0);
  const width = measured || Math.max(48, screen.width - 54);
  const each = Math.floor(items / plates);
  const count = each * plates;
  const plan = proofTempo({ rounds: count, dense: items > 12 });
  const beats = useRevealBeats(measured ? plan.count : null, { ...plan, awaitInitialPaint: canSnapshotCanvas, onDone: width ? onSolutionShown : undefined });
  const canvas = useCanvasRef();
  const drawing = useModelPaint(!!measured, beats, canvas);
  const { reduced, landed, settled } = beats;
  const { time, dealt } = useDealProgress(beats, count, plan.batchSize, 1);
  const layout = sharingTableLayout(width, Array(plates).fill(each), items, plates);
  const activeBox = layout.boxes[dealt ? 1 + (dealt - 1) % plates : 0];
  const focus = (activeBox.y + activeBox.height / 2) / layout.height;
  const phrase = (n: number) => t('friendlyQ.cookieTally', { defaultValue: 'Tray: {{remaining}} · Plates: {{counts}}', remaining: items - n,
    counts: Array.from({ length: plates }, (_, i) => Math.floor((n + plates - 1 - i) / plates)).join(', ') });
  const result = items === count ? `${items} ÷ ${plates} = ${each}` : t('cookieShare.result', { each, left: items - count });
  useProofAnnouncement(beats, settled ? result : phrase(dealt), width > 0);
  return <View style={{ alignSelf: 'stretch' }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>{width > 0 && <RevealSurface beats={beats}>
    <LandingFrame reduced={reduced} step={landed}><View ref={drawing} collapsable={false} nativeID="play-proof-model" testID="play-proof-model"><ProofWindow focus={focus}>
      <Canvas ref={canvas} pointerEvents="none" style={{width, height: layout.height}}>
        {layout.boxes.map((box, i) => {
          if (i === 0) return dealt < items && <Group key="supply">
            <RoundedRect x={box.x + 1} y={box.y + 1} width={box.width - 2} height={box.height - 2} r={Shape.tray(box.height)} color={Ink.tray} />
          </Group>;
          const active = settled || dealt > 0 && (dealt - 1) % plates === i - 1;
          const stroke = Shape.stroke.silhouette;
          const rim = {x: box.x + stroke / 2, y: box.y + stroke / 2, width: box.width - stroke, height: box.height - stroke};
          const dx = Math.min(12, box.width * .1), dy = Math.min(9, box.height * .12);
          const well = {x: box.x + dx, y: box.y + dy, width: box.width - 2 * dx, height: box.height - 2 * dy};
          return <Group key={i}>
            <Oval {...rim} color={active ? PuzzleColors.selectedSurface : Shape.empty} />
            <Oval {...well} color={PuzzleColors.card} />
          </Group>;
        })}
        {Array.from({ length: items }, (_, id) => {
        const from = sharingSlot(layout.boxes[0], id);
        const to = id < count ? sharingSlot(layout.boxes[1 + id % plates], Math.floor(id / plates)) : from;
        return <DealtCookie key={id} {...{ id, from, to, time, width }} contact={dealt === id + 1 && !beats.skipped && !reduced} />;
      })}</Canvas>
    </ProofWindow></View></LandingFrame>
    <ProofEquationSlot settled={settled}><ProofCaption text={settled ? result : ''} reserveTexts={[result]} /></ProofEquationSlot>
  </RevealSurface>}</View>;
}
