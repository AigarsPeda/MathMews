import { CoinCounter } from '@/components/economy/CoinCounter';
import { DifficultyPicker } from '@/components/puzzle/DifficultyPicker';
import { PuzzlePathItem } from '@/components/puzzle/PuzzlePathItem';
import { GameColors } from '@/constants/game';
import {
  canPlayPuzzleIndex,
  DIFFICULTY_LABELS,
  getPuzzlePathState,
  PUZZLES_BY_DIFFICULTY,
} from '@/constants/puzzles';
import { useGame } from '@/contexts/GameProvider';
import type { PuzzleDifficulty } from '@/types/puzzle';
import { moderateScale } from '@/utils/scale';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function PuzzlesScreen() {
  const router = useRouter();
  const { isReady, hasCompletedOnboarding, pet, wallet, progress } = useGame();
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('easy');

  const puzzles = PUZZLES_BY_DIFFICULTY[difficulty];
  const solvedCount = progress.puzzlesSolved[difficulty];
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = Math.min(solvedCount, Math.max(0, puzzles.length - 1));

  const progressPercent =
    puzzles.length > 0
      ? Math.min(100, (Math.min(solvedCount, puzzles.length) / puzzles.length) * 100)
      : 0;

  const scrollToCurrent = useCallback((y: number) => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - moderateScale(8)),
      animated: true,
    });
  }, []);

  const handleSelectDifficulty = useCallback((next: PuzzleDifficulty) => {
    triggerHaptic();
    setDifficulty(next);
  }, []);

  const handlePlayPuzzle = useCallback(
    (index: number, isReplay: boolean) => {
      if (!canPlayPuzzleIndex(index, solvedCount)) return;
      triggerHaptic();
      router.push({
        pathname: '/play',
        params: {
          difficulty,
          index: String(index),
          ...(isReplay ? { replay: 'true' } : {}),
        },
      });
    },
    [difficulty, router, solvedCount],
  );

  const handlePlayCurrent = useCallback(() => {
    if (solvedCount >= puzzles.length) return;
    handlePlayPuzzle(solvedCount, false);
  }, [handlePlayPuzzle, puzzles.length, solvedCount]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={GameColors.primary} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding/name-pet" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <CoinCounter coins={wallet.coins} streak={progress.streak} />
        </View>

        <Text style={styles.title}>Puzzle path</Text>
        <Text style={styles.subtitle}>Choose a difficulty for {pet.name}</Text>

        <DifficultyPicker
          selected={difficulty}
          onSelect={handleSelectDifficulty}
        />

        <View style={styles.progressBlock}>
          <Text style={styles.progressText}>
            {Math.min(solvedCount, puzzles.length)} of {puzzles.length}{' '}
            {DIFFICULTY_LABELS[difficulty].toLowerCase()} nuts cracked
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {puzzles.map((puzzle, index) => {
            const state = getPuzzlePathState(index, solvedCount);
            return (
              <PuzzlePathItem
                key={puzzle.id}
                puzzle={puzzle}
                puzzleNumber={index + 1}
                state={state}
                onLayout={(y) => {
                  if (index === currentIndex) {
                    requestAnimationFrame(() => scrollToCurrent(y));
                  }
                }}
                onPress={() => handlePlayPuzzle(index, state === 'completed')}
              />
            );
          })}

          {solvedCount >= puzzles.length ? (
            <View style={styles.completeCard}>
              <Text style={styles.completeEmoji}>🎉</Text>
              <Text style={styles.completeTitle}>
                All {DIFFICULTY_LABELS[difficulty].toLowerCase()} nuts cracked!
              </Text>
              <Text style={styles.completeText}>
                Try another difficulty or replay your favorites.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {solvedCount < puzzles.length ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={handlePlayCurrent}
            accessibilityRole="button"
            accessibilityLabel="Play current puzzle"
          >
            <Text style={styles.primaryBtnText}>
              Play nut #{solvedCount + 1}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
    gap: moderateScale(12),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: 'center',
    paddingRight: moderateScale(12),
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: GameColors.text,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: GameColors.textMuted,
    marginTop: moderateScale(-4),
  },
  progressBlock: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(8),
  },
  progressText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: GameColors.text,
    textAlign: 'center',
  },
  progressTrack: {
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: GameColors.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: moderateScale(4),
    backgroundColor: GameColors.success,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(16),
  },
  primaryBtn: {
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(16),
  },
  primaryBtnText: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  completeCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.success,
    padding: moderateScale(16),
    alignItems: 'center',
    gap: moderateScale(6),
    marginTop: moderateScale(4),
  },
  completeEmoji: {
    fontSize: moderateScale(32),
  },
  completeTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: GameColors.text,
    textAlign: 'center',
  },
  completeText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: GameColors.textMuted,
    textAlign: 'center',
  },
});
