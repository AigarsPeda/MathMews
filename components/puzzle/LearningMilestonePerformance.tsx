import { NativeCatDisplay } from '@/components/pet/native/NativeCatDisplay';
import { createPuzzleReactionSegment } from '@/pet-display/registry/cat-model-registry';
import type { PetPlaybackState } from '@/pet-display/types';
import type { LearningMilestone } from '@/constants/learning-milestones';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import { PuzzleText as Text } from './PuzzleText';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

/** One collected performance, never a repeating reward or a navigation gate. */
export function LearningMilestonePerformance({ milestone, catSkinId, active = true }: { milestone: LearningMilestone; catSkinId?: string; active?: boolean }) {
  const { active: foreground, reduceMotion } = useAnimationActivity();
  const { t } = useTranslation();
  const [finished, setFinished] = useState(false), [replay, setReplay] = useState(0), [paused, setPaused] = useState(false);
  const playback = useMemo<PetPlaybackState>(() => {
    const steps = milestone.performance.map(reaction => createPuzzleReactionSegment(reaction));
    return { kind: 'scenario', scenario: { id: 'learningMilestone', label: '', steps }, steps };
  }, [milestone]);
  const still = useMemo<PetPlaybackState>(() => ({ kind: 'segment', mood: 'correct', segment: createPuzzleReactionSegment('puzzleProud') }), []);
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.title}>{t(`actionMotion.milestone${milestone.lessons}`)}</Text>
    <Text style={styles.caption}>{t('actionMotion.milestoneEarned', { count: milestone.lessons })}</Text>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <NativeCatDisplay key={replay} skinId={catSkinId} width={220} playback={reduceMotion ? still : playback}
        playing={active && foreground && !paused && !finished} onAnimationComplete={() => setFinished(true)} />
    </View>
    <View style={styles.controls}>
      {!reduceMotion && !finished ? <Pressable accessibilityRole="button" onPress={() => setPaused(value => !value)} style={styles.control}><Text style={styles.link}>{t(paused ? 'actionMotion.resume' : 'actionMotion.pause')}</Text></Pressable> : null}
      {!reduceMotion ? <Pressable accessibilityRole="button" onPress={() => { setFinished(false); setPaused(false); setReplay(value => value + 1); }} style={styles.control}><Text style={styles.link}>{t('actionMotion.replay')}</Text></Pressable> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%', gap: 12 },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '800', color: C.text, textAlign: 'center' },
  caption: { fontSize: 16, lineHeight: 23, color: C.textMuted, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: 16 },
  control: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '700', color: C.primaryDark },
});
