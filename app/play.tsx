import { CoinCounter } from "@/components/economy/CoinCounter";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import {
  GameColors,
  PUZZLE_COIN_REWARDS,
  PUZZLE_HAPPINESS_BOOST,
  PUZZLE_REPLAY_COIN_REWARDS,
  PUZZLE_REPLAY_HAPPINESS_BOOST,
} from "@/constants/game";
import {
  canPlayPuzzleIndex,
  getPuzzleForSession,
  isPuzzleDifficulty,
  PUZZLES_BY_DIFFICULTY,
} from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import type { PetAnimationState } from "@/types/game";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export default function PlayScreen() {
  const router = useRouter();
  const {
    difficulty: difficultyParam,
    index: indexParam,
    replay: replayParam,
  } = useLocalSearchParams<{
    difficulty?: string;
    index?: string;
    replay?: string;
  }>();
  const rawDifficulty = Array.isArray(difficultyParam)
    ? difficultyParam[0]
    : difficultyParam;
  const difficulty: PuzzleDifficulty = isPuzzleDifficulty(rawDifficulty ?? "")
    ? rawDifficulty
    : "easy";
  const rawIndex = Array.isArray(indexParam) ? indexParam[0] : indexParam;
  const parsedIndex =
    rawIndex !== undefined && rawIndex !== "" ? Number.parseInt(rawIndex, 10) : NaN;
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    setPet,
    setWallet,
    setProgress,
  } = useGame();

  const puzzles = PUZZLES_BY_DIFFICULTY[difficulty];
  const savedIndex = progress.puzzlesSolved[difficulty];
  const sessionIndex = Number.isFinite(parsedIndex) ? parsedIndex : savedIndex;
  const isReplay =
    replayParam === "true" ||
    (Number.isFinite(parsedIndex) && parsedIndex < savedIndex);
  const puzzle = useMemo(
    () => getPuzzleForSession(difficulty, sessionIndex),
    [difficulty, sessionIndex],
  );

  const puzzleNumber = sessionIndex + 1;
  const coinReward = isReplay
    ? PUZZLE_REPLAY_COIN_REWARDS[puzzle.difficulty]
    : PUZZLE_COIN_REWARDS[puzzle.difficulty];
  const happinessBoost = isReplay
    ? PUZZLE_REPLAY_HAPPINESS_BOOST
    : PUZZLE_HAPPINESS_BOOST;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  const answered = selectedIndex !== null;
  const resultMood: PetAnimationState = isCorrect ? "correct" : "sad";

  const handleChoice = useCallback(
    (index: number) => {
      if (answered) return;

      const correct = index === puzzle.correctIndex;
      setSelectedIndex(index);
      setIsCorrect(correct);

      if (correct) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setCoinsEarned(coinReward);
        setWallet((current) => ({ coins: current.coins + coinReward }));
        setPet((current) => ({
          ...current,
          stats: {
            ...current.stats,
            happiness: Math.min(
              100,
              current.stats.happiness + happinessBoost,
            ),
          },
        }));
      } else {
        triggerHaptic();
      }
    },
    [answered, coinReward, happinessBoost, puzzle.correctIndex, setPet, setWallet],
  );

  const exitToPath = useCallback(() => {
    router.replace("/puzzles");
  }, [router]);

  const handleContinue = useCallback(() => {
    if (isCorrect && isReplay) {
      exitToPath();
      return;
    }

    if (isCorrect) {
      setProgress((current) => ({
        ...current,
        puzzlesSolved: {
          ...current.puzzlesSolved,
          [difficulty]: current.puzzlesSolved[difficulty] + 1,
        },
      }));
      if (sessionIndex + 1 >= puzzles.length) {
        exitToPath();
        return;
      }
      router.push({
        pathname: "/play",
        params: { difficulty, index: String(sessionIndex + 1) },
      });
      return;
    }

    setSelectedIndex(null);
    setIsCorrect(false);
    setCoinsEarned(0);
  }, [
    difficulty,
    exitToPath,
    isCorrect,
    isReplay,
    puzzles.length,
    router,
    sessionIndex,
    setProgress,
  ]);

  const handleGoHome = useCallback(() => {
    if (isCorrect && !isReplay) {
      setProgress((current) => ({
        ...current,
        puzzlesSolved: {
          ...current.puzzlesSolved,
          [difficulty]: current.puzzlesSolved[difficulty] + 1,
        },
      }));
    }
    if (isReplay || (isCorrect && sessionIndex + 1 >= puzzles.length)) {
      exitToPath();
      return;
    }
    router.back();
  }, [
    difficulty,
    exitToPath,
    isCorrect,
    isReplay,
    puzzles.length,
    router,
    sessionIndex,
    setProgress,
  ]);

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

  if (sessionIndex < 0 || sessionIndex >= puzzles.length) {
    return <Redirect href="/puzzles" />;
  }

  if (!canPlayPuzzleIndex(sessionIndex, savedIndex)) {
    return <Redirect href="/puzzles" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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

        <Text style={styles.title}>
          {isReplay ? `Replay nut #${puzzleNumber}` : `Solve for ${pet.name}`}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PuzzleCard puzzle={puzzle} puzzleNumber={puzzleNumber} />

          <View style={styles.choices}>
            {puzzle.choices.map((choice, index) => {
              let result: "correct" | "wrong" | null = null;
              if (answered) {
                if (index === puzzle.correctIndex) {
                  result = "correct";
                } else if (index === selectedIndex) {
                  result = "wrong";
                }
              }

              return (
                <ChoiceButton
                  key={`${puzzle.id}-${choice}`}
                  label={choice}
                  selected={selectedIndex === index}
                  disabled={answered}
                  result={result}
                  onPress={() => handleChoice(index)}
                />
              );
            })}
          </View>
        </ScrollView>

        <ResultOverlay
          visible={answered}
          correct={isCorrect}
          petMood={resultMood}
          message={isCorrect ? (isReplay ? "Cracked it again!" : "Great job!") : "Good try!"}
          detail={isCorrect ? puzzle.explanation : puzzle.hint}
          coinsEarned={coinsEarned}
          coinType={isReplay ? "sparkle" : "regular"}
          continueLabel={
            isCorrect ? (isReplay ? "Back to path" : "Next puzzle") : "Try again"
          }
          onContinue={handleContinue}
          onGoHome={isCorrect && !isReplay ? handleGoHome : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: moderateScale(8),
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: "center",
    paddingRight: moderateScale(12),
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
    marginBottom: moderateScale(12),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: moderateScale(16),
    paddingBottom: moderateScale(24),
  },
  choices: {
    gap: moderateScale(12),
  },
});
