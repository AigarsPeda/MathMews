import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { NoLivesPanel } from "@/components/economy/LivesCounter";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import {
  GameColors,
  getPuzzleCoinReward,
  LIFE_BUY_COST,
  PUZZLE_HAPPINESS_BOOST,
  PUZZLE_HUNGER_COST,
  PUZZLE_REPLAY_HAPPINESS_BOOST,
  PUZZLE_WRONG_HAPPINESS_PENALTY,
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
import { clampStat, withPetCareUpdate } from "@/utils/pet-care";
import {
  applyLifeRegen,
  canSpendLife,
  loseLife,
} from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    buyLife,
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
  const coinReward = getPuzzleCoinReward(difficulty, isReplay);
  const happinessBoost = isReplay
    ? PUZZLE_REPLAY_HAPPINESS_BOOST
    : PUZZLE_HAPPINESS_BOOST;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  const syncedLives = useMemo(
    () => applyLifeRegen(progress.lives),
    [progress.lives],
  );
  const hasLives = syncedLives.current > 0;
  const answered = selectedIndex !== null;
  const resultMood: PetAnimationState = isCorrect ? "correct" : "sad";

  useEffect(() => {
    setSelectedIndex(null);
    setIsCorrect(false);
    setCoinsEarned(0);
  }, [difficulty, sessionIndex]);

  const exitToPath = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: "/puzzles",
      params: { difficulty },
    });
  }, [difficulty, router]);

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
        setPet((current) =>
          withPetCareUpdate(current, (stats) => ({
            ...stats,
            hunger: clampStat(stats.hunger - PUZZLE_HUNGER_COST),
            happiness: clampStat(stats.happiness + happinessBoost),
          })),
        );
      } else {
        triggerHaptic();
        setProgress((current) => ({
          ...current,
          lives: loseLife(current.lives),
        }));
        setPet((current) =>
          withPetCareUpdate(current, (stats) => ({
            ...stats,
            hunger: clampStat(stats.hunger - PUZZLE_HUNGER_COST),
            happiness: clampStat(
              stats.happiness - PUZZLE_WRONG_HAPPINESS_PENALTY,
            ),
          })),
        );
      }
    },
    [
      answered,
      coinReward,
      happinessBoost,
      puzzle.correctIndex,
      setPet,
      setProgress,
      setWallet,
    ],
  );

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
      router.replace({
        pathname: "/play",
        params: { difficulty, index: String(sessionIndex + 1) },
      });
      return;
    }

    if (!isCorrect) {
      if (!canSpendLife(progress.lives)) {
        exitToPath();
        return;
      }
      setSelectedIndex(null);
      setIsCorrect(false);
      setCoinsEarned(0);
      return;
    }
  }, [
    difficulty,
    exitToPath,
    isCorrect,
    isReplay,
    progress.lives,
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
    router.replace('/');
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
    return (
      <Redirect
        href={{ pathname: "/puzzles", params: { difficulty } }}
      />
    );
  }

  if (!canPlayPuzzleIndex(sessionIndex, savedIndex)) {
    return (
      <Redirect
        href={{ pathname: "/puzzles", params: { difficulty } }}
      />
    );
  }

  if (!hasLives) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={exitToPath}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <GameHeaderStats
              coins={wallet.coins}
              streak={progress.streak}
              lives={progress.lives}
            />
          </View>
          <NoLivesPanel
            lives={progress.lives}
            coins={wallet.coins}
            onBuyLife={buyLife}
            onBack={exitToPath}
          />
        </View>
      </SafeAreaView>
    );
  }

  const livesAfterAnswer = applyLifeRegen(progress.lives);
  const canRetry = livesAfterAnswer.current > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={exitToPath}
            disabled={answered}
            style={[styles.backBtn, answered && styles.backBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityState={{ disabled: answered }}
          >
            <Text style={[styles.backText, answered && styles.backTextDisabled]}>
              ← Back
            </Text>
          </Pressable>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <Text style={styles.title}>
          {isReplay ? `Replay nut #${puzzleNumber}` : `Solve for ${pet.name}`}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PuzzleCard
            puzzle={puzzle}
            puzzleNumber={puzzleNumber}
            coinReward={coinReward}
          />

          <View style={styles.choices}>
            {puzzle.choices.map((choice, index) => {
              let result: "correct" | "wrong" | null = null;
              if (answered) {
                if (isCorrect && index === puzzle.correctIndex) {
                  result = "correct";
                } else if (!isCorrect && index === selectedIndex) {
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
            isCorrect
              ? isReplay
                ? "Back to path"
                : "Next puzzle"
              : canRetry
                ? "Try again"
                : "Back to path"
          }
          onContinue={handleContinue}
          onGoHome={isCorrect && !isReplay ? handleGoHome : undefined}
          onBuyLife={!isCorrect && !canRetry ? buyLife : undefined}
          buyLifeCost={LIFE_BUY_COST}
          coins={wallet.coins}
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
  backBtnDisabled: {
    opacity: 0.35,
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  backTextDisabled: {
    color: GameColors.textMuted,
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
