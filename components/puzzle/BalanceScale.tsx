/**
 * The one balance in Math Mews: a flat front elevation drawn from the style
 * guide recipe. One teal beam with rounded ends rests on a small pivot and a
 * low triangular foot; two identical trays stand on short posts. Loads are
 * live, upright views that rest on the tray surface. A level beam means
 * "both sides are equal"; callers only tilt it once an inequality has been
 * resolved, by an angle that grows with the difference (2.5°–8°).
 */
import { LandSpring, Motion, PuzzleColors, Quantity } from '@/constants/puzzle-theme';
import { useProofViewport } from './PlayProofCaption';
import { ProofWindow } from './everyday/ProofWindow';
import { moderateScale } from '@/utils/scale';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

/** Largest tilt for a resolved inequality, in degrees. */
export const BALANCE_MAX_TILT = 8;
const MIN_TILT = 2.5;

/** Beam angle for two loads: level when equal, otherwise toward the heavier side, growing with the difference. */
export function balanceTilt(left: number, right: number) {
  if (left === right) return 0;
  const share = Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.sign(right - left) * Math.min(BALANCE_MAX_TILT, MIN_TILT + (BALANCE_MAX_TILT - MIN_TILT) * share);
}

const GAP = moderateScale(28);
const BEAM = moderateScale(20);
const POST = moderateScale(20);
const TRAY = moderateScale(26);
const FOOT_H = moderateScale(50);
const FOOT_W = moderateScale(60);
const BASE_W = moderateScale(128);
const BASE_H = moderateScale(10);
const PIVOT = moderateScale(26);

const teal = Quantity.teal;

export type PanAction = { label: string; active: boolean; enabled: boolean; onPress: () => void };

type ArmLayout = { wide: boolean; proofFocus?: number; inset: number; postHeight: number; minimumLoad: number; trayHeight: number };

function Arm({ children, side, tilt, reach, bump, action, layout, width }: {
  children: ReactNode; side: -1 | 1; tilt?: SharedValue<number>; reach: number;
  bump?: unknown; action?: PanAction; layout: ArmLayout; width?: number;
}) {
  const { wide, proofFocus, inset, postHeight, minimumLoad, trayHeight } = layout;
  const reduce = useReducedMotion();
  // A load put on the tray presses it down a little, and it springs back.
  const dip = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce || bump == null) return;
    dip.set(withSequence(withTiming(moderateScale(4), { duration: Motion.tap }), withSpring(0, LandSpring)));
  }, [bump, reduce, dip]);
  // Each tray stays upright and rides on the end of the beam.
  const ride = useAnimatedStyle(() => {
    const angle = (tilt?.value ?? 0) * Math.PI / 180;
    return { transform: [{ translateY: side * reach * Math.sin(angle) + dip.value }] };
  });
  return <Animated.View style={[styles.arm, width !== undefined && { flex: 0, width }, ride]}>
    <View style={[styles.load, !wide && { paddingHorizontal: moderateScale(4) }, { minHeight: minimumLoad }]}>
      <ProofWindow playing={proofFocus !== undefined} inset={inset} focus={proofFocus}>{children}</ProofWindow>
    </View>
    <View style={[styles.tray, !wide && { backgroundColor: teal.light }, { height: trayHeight }, action?.active && action.enabled && styles.armedTray]} />
    {action && <Pressable testID={side === -1 ? "balance-left-pan" : "balance-right-pan"} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={action.label}
      disabled={!action.enabled} accessibilityState={{ disabled: !action.enabled }} onPress={action.onPress} />}
    <View style={[styles.post, !wide && { backgroundColor: teal.edge }, { height: postHeight + BEAM / 2 }]} />
  </Animated.View>;
}

/**
 * @param tilt Beam angle in degrees (positive = right side down). Leave unset for a fixed, level scale.
 */
export function BalanceScale({ left, right, tilt, accessibilityLabel, leftBump, rightBump, leftAction, rightAction, proofFocus, wide = false, rightWidth, gap = GAP, loadHeight }: {
  left: ReactNode; right: ReactNode; tilt?: SharedValue<number>; accessibilityLabel?: string;
  /** Change these to bounce a tray when something is put on it. */
  leftBump?: unknown; rightBump?: unknown; leftAction?: PanAction; rightAction?: PanAction; proofFocus?: number;
  /** Space between the trays (a smaller gap gives wider trays for longer rows). */
  gap?: number;
  wide?: boolean;
  rightWidth?: number;
  /** Keep both trays at this height above the beam while loads come and go (picture help). */
  loadHeight?: number;
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, window.width - moderateScale(64)));
  const viewport = useProofViewport();
  const height = proofFocus === undefined ? Infinity : viewport?.availableModelHeight ?? Infinity;
  const compact = height < moderateScale(240);
  const footHeight = compact ? moderateScale(14) : FOOT_H;
  const postHeight = compact ? moderateScale(10) : POST;
  const reach = (width + gap) / 4;
  const rightReach = rightWidth === undefined ? reach : (width - rightWidth) / 2;
  const leftReach = rightWidth === undefined ? reach : (rightWidth + gap) / 2;
  const top = proofFocus !== undefined && tilt ? Math.ceil(Math.max(rightReach, leftReach) * Math.sin((compact ? 6 : BALANCE_MAX_TILT) * Math.PI / 180)) : moderateScale(8);
  const trayHeight = compact ? moderateScale(16) : TRAY;
  const inset = top + moderateScale(4) + trayHeight + postHeight + footHeight + BASE_H;
  const minimumLoad = loadHeight ?? Math.max(0, Math.min(moderateScale(96), height - inset));
  const armLayout = { wide, proofFocus, inset, postHeight, minimumLoad, trayHeight };
  const beamLength = wide ? width : width ? reach * 2 + moderateScale(36) : 0;
  const beamStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt?.value ?? 0}deg` }] }));
  const foot = useMemo(() => {
    const p = Skia.Path.Make();
    const r = moderateScale(4);
    p.moveTo(FOOT_W / 2 - r, 1);
    p.lineTo(FOOT_W / 2 + r, 1);
    p.lineTo(FOOT_W - 1, footHeight - 1);
    p.lineTo(1, footHeight - 1);
    p.close();
    return p;
  }, [footHeight]);
  return <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={[styles.scale, wide && styles.wide, { paddingTop: top }]}
    onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View style={[styles.arms, { gap }]}>
      <Arm side={-1} tilt={tilt} reach={leftReach} layout={armLayout} action={leftAction} bump={leftBump}>{left}</Arm>
      <Arm side={1} width={rightWidth} tilt={tilt} reach={rightReach} layout={armLayout} action={rightAction} bump={rightBump}>{right}</Arm>
    </View>
    <View style={[styles.stand, { height: footHeight + BASE_H }]} pointerEvents="none">
      <Canvas style={[styles.foot, { height: footHeight }]}>
        <Path path={foot} color={teal.fill} />
      </Canvas>
      <View style={[styles.base, !wide && { backgroundColor: teal.edge }]} />
      {beamLength > 0 ? <Animated.View style={[styles.beam, { width: beamLength, left: (width - beamLength) / 2 }, beamStyle]}>
        <View style={[styles.pivot, !wide && { backgroundColor: teal.onFill }]} />
      </Animated.View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  scale: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: moderateScale(4) },
  wide: { width: undefined, maxWidth: undefined, alignSelf: 'stretch', marginHorizontal: 8 },
  arms: { flexDirection: 'row', alignItems: 'stretch', gap: GAP },
  arm: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  // Loads rest on the tray: no gap between the load and the tray surface.
  load: { width: '100%', flexGrow: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 0, marginBottom: -1 },
  // A shallow dish: flat top edge, rounded underside.
  // A flat, tinted plate: it is a fixture, not a piece, so no lip.
  tray: { alignSelf: 'stretch', height: TRAY, backgroundColor: teal.fill, borderRadius: 10 },
  armedTray: { backgroundColor: PuzzleColors.selectedSurface },
  post: { width: moderateScale(10), backgroundColor: teal.fill, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  stand: { marginTop: -BEAM / 2, alignItems: 'center' },
  foot: { position: 'absolute', top: BEAM / 2, width: FOOT_W },
  base: { position: 'absolute', bottom: 0, width: BASE_W, height: BASE_H, borderRadius: BASE_H / 2, backgroundColor: teal.fill },
  beam: { position: 'absolute', top: 0, height: BEAM, borderRadius: BEAM / 2, backgroundColor: teal.fill,
    alignItems: 'center', justifyContent: 'center' },
  pivot: { width: PIVOT, height: PIVOT, borderRadius: PIVOT / 2, backgroundColor: Quantity.violet.fill },
});
