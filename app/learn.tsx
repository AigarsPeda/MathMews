import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuidedLearning } from '@/components/puzzle/GuidedLearning';
import { LEARNING_CATALOG } from '@/constants/curriculum';
import { GameColors } from '@/constants/game';
import { useGame } from '@/contexts/GameProvider';
import { useLocale } from '@/contexts/LocaleProvider';
import type { LearningLesson } from '@/types/curriculum';

export default function LearnScreen() {
  const params = useLocalSearchParams<{ lesson?: string; source?: string }>();
  const { isReady, hasCompletedOnboarding } = useGame();
  const lesson = LEARNING_CATALOG.lessons.find(l => l.id === params.lesson);
  if (!isReady) return <View style={styles.safe}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if (!lesson) return <Redirect href="/puzzles" />;
  return <LearnSession key={lesson.id} lesson={lesson} source={params.source} />;
}

// Mount after save hydration so reopening continues the saved example sequence.
function LearnSession({ lesson, source }: { lesson: LearningLesson; source?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const { pet, finishGuidedLearning, recordLearningHelp, progress } = useGame();
  const [variant, setVariant] = useState(() => lesson.skillId ? progress.learningEvidence?.[lesson.skillId]?.guidedSessions ?? 0 : 0);
  const [attempt, setAttempt] = useState(() => `guided-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const back = () => router.canGoBack() ? router.back() : router.replace('/puzzles');
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <GuidedLearning key={`${lesson.id}-${attempt}`} lesson={lesson} locale={locale} variant={variant} petType={pet.type} catSkinId={pet.catSkinId}
      onFinish={() => { if (source && lesson.levels.some(l => l.puzzleIds.includes(source!))) recordLearningHelp(source); finishGuidedLearning(lesson.id, attempt); }}
      onAnother={() => { setVariant(v => v + 1); setAttempt(`guided-${Date.now()}-${Math.random().toString(36).slice(2)}`); }} onBack={back} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: GameColors.background } });
