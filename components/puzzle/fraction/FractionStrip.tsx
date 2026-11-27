import { Caption } from '@/components/puzzle/kit/Focus';
import { EntryBuild } from '../kit/PracticeAffordances';
import { PuzzleColors, Quantity, Shape } from '@/constants/puzzle-theme';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

export const fractionStripGap = 10;
/** Strip cells are chunky: every strip model (entry, proof, miss) uses this one height. */
export const fractionStripHeight = 72;

const violet = Quantity.violet;
const amber = Quantity.amber;

type Alignment = { position: SharedValue<number>; snapped?: boolean };
type StripProps = {
  parts: number; shaded: number; selected?: readonly number[]; height?: number;
  gap?: number; width?: number; alignment?: Alignment; highlighted?: readonly number[];
  animateEntry?: boolean; animateChange?: boolean; demoFace?: boolean;
  target?: number; opening?: boolean; pulseKey?: number;
  /** The reference strip is teal; the child's strip is violet. */
  tone?: 'teal' | 'violet';
  /** Cells past the reference edge (amber) and cells still missing before it (soft amber). */
  over?: readonly number[]; under?: readonly number[];
};

/** A partition always uses the same whole bounds. The optional guide is painted into the faces. */
export function FractionStrip({ parts, shaded, selected, height = 40, gap: requestedGap = Shape.space.seam, width, alignment, highlighted,
  animateEntry = false, animateChange = false, demoFace = false, target, opening = false, pulseKey, tone = 'violet', over, under }: StripProps) {
  const seam = useSharedValue(opening ? 0 : 1);
  const reduced = useReducedMotion();
  useEffect(() => {
    seam.set(opening && !reduced ? withTiming(1, { duration: 210 }) : 1);
    return () => cancelAnimation(seam);
  }, [opening, parts, reduced, seam]);
  const active = selected ?? Array.from({ length: shaded }, (_, index) => index);
  const gap = width === undefined ? requestedGap : Math.max(0, Math.min(requestedGap, width / parts - 1));
  const moving = alignment && width !== undefined && active.length > 0;
  return <View style={[styles.strip, { height, width: width ?? '100%' }]} pointerEvents="none"
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: parts - 1 }, (_, index) => {
      const boundary = (index + 1) / parts;
      return <View key={`gap-${index}`} style={[styles.gap, { left: `${boundary * 100}%`, width: gap, marginLeft: (boundary - 1) * gap }]} />;
    })}
    {Array.from({ length: parts }, (_, index) => {
      const on = !moving && active.includes(index);
      const guide = Math.max(0, Math.min(1, (target ?? 0) * parts - index));
      const face = <StripFace shaded={on} highlighted={highlighted?.includes(index)} height={height} guide={guide}
        seam={seam} before={index / parts * gap} after={(1 - (index + 1) / parts) * gap}
        opening={opening} animateChange={animateChange} pulseKey={pulseKey} demo={demoFace && index === 0 && !on}
        tone={tone} flag={over?.includes(index) ? 'over' : under?.includes(index) ? 'under' : undefined} />;
      const position = [styles.unit, { left: `${index / parts * 100}%` as const, width: `${100 / parts}%` as const }];
      return animateEntry ? <EntryBuild key={index} index={index} style={position}><View style={{ height }}>{face}</View></EntryBuild>
        : <View key={index} style={position}>{face}</View>;
    })}
    {moving ? [...active].sort((a, b) => a - b).map((from, to) => <AlignFace key={from} from={from} to={to}
      pitch={(width + gap) / parts} gap={gap} height={height} alignment={alignment} seam={seam} />) : null}
  </View>;
}

function AlignFace({ from, to, pitch, gap, height, alignment: { position, snapped }, seam }: {
  from: number; to: number; pitch: number; gap: number; height: number; alignment: Alignment; seam: SharedValue<number>;
}) {
  const motion = useAnimatedStyle(() => {
    const step = snapped === undefined ? Math.max(0, Math.min(1, position.get())) : Number(snapped);
    return { transform: [{ translateX: (to - from) * pitch * step }] };
  });
  return <Animated.View style={[styles.unit, { left: from * pitch, width: pitch - gap }, motion]}>
    <StripFace shaded height={height} seam={seam} />
  </Animated.View>;
}

function StripFace({ shaded, highlighted, height, guide = 0, seam, before = 0, after = 0, opening = false, animateChange = false, demo = false, pulseKey, tone = 'violet', flag }: {
  shaded: boolean; highlighted?: boolean; height: number; guide?: number; seam: SharedValue<number>; before?: number; after?: number;
  opening?: boolean; animateChange?: boolean; demo?: boolean; pulseKey?: number; tone?: 'teal' | 'violet'; flag?: 'over' | 'under';
}) {
  const previous = useRef({ shaded, highlighted, pulseKey });
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    const tapped = animateChange && previous.current.shaded !== shaded;
    const pulsed = highlighted && (!previous.current.highlighted || pulseKey !== previous.current.pulseKey);
    previous.current = { shaded, highlighted, pulseKey };
    if (reduced) return;
    if (tapped || pulsed) {
      scale.set(withSequence(withTiming(.89, { duration: 65 }), withTiming(1.03, { duration: 85 }), withTiming(1, { duration: 70 })));
    } else if (demo) {
      scale.set(withDelay(4000, withSequence(withTiming(.88, { duration: 100 }), withTiming(1.04, { duration: 120 }), withTiming(1, { duration: 90 }))));
    } else {
      scale.set(1);
    }
    return () => cancelAnimation(scale);
  }, [animateChange, demo, highlighted, pulseKey, reduced, scale, shaded]);
  const motion = useAnimatedStyle(() => ({
    top: opening ? (1 - seam.get()) * -Shape.lip : 0,
    marginLeft: opening ? before * seam.get() : before,
    marginRight: opening ? after * seam.get() : after,
    transform: [{ scale: scale.get() }],
  }));
  const radius = Shape.tile(height);
  const hue = tone === 'teal' ? Quantity.teal : violet;
  const faceColor = flag === 'over' ? amber.fill : flag === 'under' ? amber.light
    : shaded ? highlighted ? hue.onFill : hue.fill
    : highlighted ? Shape.emptyLip : guide === 1 ? hue.soft : Shape.empty;
  return <Animated.View style={[styles.cell, { borderRadius: radius, backgroundColor: faceColor }, motion]}>
    {!shaded && guide > 0 && guide < 1 ? <View style={[styles.guide, { width: `${guide * 100}%` }]} /> : null}
  </Animated.View>;
}

export function FractionPartTargets({ first = 0, count, selected, onToggle }: {
  first?: number; count: number; selected: readonly number[]; onToggle: (index: number) => void;
}) {
  const { t } = useTranslation();
  return <View style={styles.targets}>
    {Array.from({ length: count }, (_, offset) => {
      const index = first + offset;
      const on = selected.includes(index);
      return <Pressable key={index} testID={`fraction-part-${index}`} accessibilityRole="button"
        accessibilityState={{ selected: on }} accessibilityLabel={`${index + 1} · ${t(on ? 'fractionModels.remove' : 'fractionModels.add')}`}
        onPress={() => onToggle(index)} style={[styles.target, on && styles.active]}>
        <Caption strong>{index + 1}</Caption>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  strip: { alignSelf: 'center', maxWidth: '100%', overflow: 'hidden' },
  gap: { position: 'absolute', top: 0, bottom: 0, backgroundColor: Shape.seamColor },
  unit: { position: 'absolute', top: 0, bottom: 0 },
  cell: { flex: 1, overflow: 'hidden' },
  guide: { height: '100%', backgroundColor: violet.soft },
  targets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Shape.space.loose },
  target: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Shape.empty, borderRadius: 8 },
  active: { backgroundColor: PuzzleColors.selectedSurface },
});
