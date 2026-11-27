/**
 * Reserves the tallest localized playback row wherever its controls render. The model itself
 * ignores touches while playing (a stray tap never erases an explanation).
 * Under Reduce Motion the end state cross-fades in and can still be replayed.
 */
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import type { RevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { landTick } from './proofHaptics';
import { ProofPlaybackContext } from './ProofFeedback';
import { Ink, Motion, PuzzleColors } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { RevealPlayContext } from './RevealPlayContext';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

export { RevealPlayContext };

/** Supply playback for controls beside the surface. Descendants inherit it. */
export function TaskLiveControls({ playback = false, children }: { playback?: boolean; children: ReactNode }) {
  const parent = useContext(ProofPlaybackContext);
  return playback || parent.playback ? null : <>{children}</>;
}

type IconName = 'next' | 'skip' | 'pause' | 'play' | 'replay';
// Draw the icon and its label in the same native text commit.
const icons: Record<IconName, string> = { next: '▸│', play: '▶︎', pause: 'Ⅱ', skip: '▸▸', replay: '↻' };

/** Mount only for a measured native model. Wait for a frame to be presented after layout. */
function NativePaintFrame({ runId, onPaint }: { runId: number; onPaint: (runId: number) => void }) {
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => {
    if (!laidOut) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => onPaint(runId));
    });
    return () => cancelAnimationFrame(frame);
  }, [laidOut, runId, onPaint]);
  return <View collapsable={false} accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}
    onLayout={event => { const { width, height } = event.nativeEvent.layout; setLaidOut(width > 0 && height > 0); }} />;
}

export function RevealSurface({ beats, children, style, replayable = true }: {
  beats: Pick<RevealBeats, 'done' | 'settled' | 'reduced' | 'skip' | 'replay'> & Partial<Pick<RevealBeats, 'preparing' | 'nativePaintPending' | 'onInitialModelPainted' | 'count' | 'landed' | 'skipped' | 'runId' | 'paused' | 'pause' | 'resume' | 'nextStep'>>;
  children: ReactNode; style?: StyleProp<ViewStyle>; replayable?: boolean;
}) {
  const { t } = useTranslation();
  const host = useContext(RevealPlayContext);
  const { Controls } = host;
  const { fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.2;
  const lastTick = useRef<string | undefined>(undefined);
  const onLanding = () => {
    if (!beats.landed || beats.runId || beats.skipped || beats.settled || !host.landingHaptics) return;
    const key = JSON.stringify([host.attemptKey, beats.landed]);
    if (lastTick.current === key) return;
    lastTick.current = key;
    landTick();
    host.onProofFrame?.({ phase: 'haptic', landed: beats.landed, runId: beats.runId ?? 0 });
  };
  const playing = !beats.settled;
  const iconSize = moderateScale(16);
  const body = beats.reduced
    ? <Animated.View key={beats.runId ?? 0} entering={FadeIn.duration(Motion.fade).reduceMotion(ReduceMotion.Never)}>{children}</Animated.View>
    : children;
  const labels = {
    pause: t('reveal.pause'), play: t('reveal.resume'), next: t('reveal.nextStep'),
    skip: t('reveal.skip'), replay: t('reveal.replay'),
  };
  const canPause = !!(beats.pause && beats.resume);
  const state = !beats.preparing && beats.count !== undefined && beats.landed !== undefined
    ? { text: t('reveal.stepStatus', { current: beats.landed, total: beats.count, defaultValue: '{{current}} / {{total}}' }) } : undefined;
  const buttonStyle = compact ? [styles.chip, styles.iconChip] : styles.chip;
  const controlLabel = (icon: IconName) => compact
    ? <Text allowFontScaling={false} style={styles.compactIcon}>{icons[icon]}</Text>
    : <Text style={styles.label}><Text allowFontScaling={false} style={{ fontSize: iconSize }}>{icons[icon]}</Text>{'  '}{labels[icon]}</Text>;
  const chip = (icon: IconName, action: () => void) => <Pressable key={icon} accessibilityRole="button"
    disabled={beats.preparing} accessibilityState={{ disabled: !!beats.preparing }}
    accessibilityLabel={labels[icon]} accessibilityValue={icon === 'next' || icon === 'play' || icon === 'pause' ? state : undefined}
    onPress={action} style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}>
    {controlLabel(icon)}
  </Pressable>;
  const probeRows: IconName[][] = canPause ? [['pause', 'skip'], ['play', 'next', 'skip'], ['replay']] : [['skip'], ['replay']];
  const controls = replayable && <View style={[styles.lane, !Controls && styles.inlineSpacing]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.probes}>
      {probeRows.map(row => <View key={row[0]} style={[styles.controls, styles.sample]}>{row.map(icon =>
        <View key={icon} style={buttonStyle}>{controlLabel(icon)}</View>)}</View>)}
    </View>
    <View style={[styles.controls, StyleSheet.absoluteFill]}>
      {playing ? <>
        {canPause && (beats.paused ? chip('play', beats.resume!) : chip('pause', beats.pause!))}
        {beats.nextStep && chip('next', beats.nextStep)}
        {chip('skip', beats.skip)}
      </> : chip('replay', () => { host.onReplay?.(); beats.replay(); })}
    </View>
  </View>;
  return <ProofPlaybackContext.Provider value={{ playback: true, settled: beats.settled, skipped: !!beats.skipped,
    onLanding, landingHaptics: !!host.landingHaptics && !beats.runId && !beats.skipped }}>
    <View style={style}>
      {/* Keep the native canvas parent mounted when pointer events change at settle. */}
      <View collapsable={false} pointerEvents={playing ? 'none' : 'auto'}
        accessibilityElementsHidden={!!beats.preparing} importantForAccessibility={beats.preparing ? 'no-hide-descendants' : 'auto'}>
        {body}
        {beats.nativePaintPending && beats.onInitialModelPainted ? <NativePaintFrame key={`paint:${beats.runId ?? 0}`} runId={beats.runId ?? 0} onPaint={beats.onInitialModelPainted} /> : null}
      </View>
      {controls && Controls ? <Controls>{controls}</Controls> : controls}
    </View>
  </ProofPlaybackContext.Provider>;
}

const styles = StyleSheet.create({
  lane: { alignSelf: 'stretch', overflow: 'hidden' },
  inlineSpacing: { marginTop: moderateScale(6) },
  probes: { flexDirection: 'row', opacity: 0 },
  sample: { width: '100%', flexShrink: 0 },
  // Reserved height: switching between the controls never moves the model.
  controls: { minHeight: 48, flexWrap: 'wrap', flexDirection: 'row', gap: moderateScale(10), alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(6), minHeight: 44, minWidth: 44,
    paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(6), maxWidth: '100%', flexShrink: 1, borderRadius: 22, backgroundColor: Ink.tray },
  iconChip: { width: 44, height: 44, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center' },
  compactIcon: { color: PuzzleColors.primaryDark, fontSize: 20, lineHeight: 26, textAlign: 'center', fontWeight: '800' },
  pressed: { backgroundColor: PuzzleColors.selectedSurface },
  // Long translations at large text wrap inside the pill instead of clipping its edges.
  label: { flexShrink: 1, textAlign: 'center', color: PuzzleColors.primaryDark, fontSize: moderateScale(15), fontWeight: '800' },
});
