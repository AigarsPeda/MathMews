import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { NoLivesPanel } from "@/components/economy/LivesCounter";
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { PuzzleTaskView } from "@/components/puzzle/PuzzleTaskView";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { VisualHelpSheet } from "@/components/puzzle/VisualHelpSheet";
import {
  GameColors,
  getPuzzleCoinReward,
  getVisualHelpCost,
  LIFE_BUY_COST,
  PUZZLE_HAPPINESS_BOOST,
  PUZZLE_HUNGER_COST,
  PUZZLE_REPLAY_HAPPINESS_BOOST,
  PUZZLE_WRONG_HAPPINESS_PENALTY,
} from "@/constants/game";
import {
  canPlayPuzzleIndex,
  getNextIncompleteDifficulty,
  getPuzzleForSession,
  getPuzzlesByDifficulty,
  isPuzzleDifficulty,
} from "@/constants/puzzles";
import { hasVisualExplanation } from "@/constants/visual-explanations";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import type { PetAnimationState } from "@/types/game";
import type { MathOperator, Puzzle, PuzzleDifficulty } from "@/types/puzzle";
import { applyLifeRegen, canSpendLife, loseLife } from "@/utils/lives";
import { clampStat, withPetCareUpdate } from "@/utils/pet-care";
import { checkPuzzleAnswer, getOperatorSlotCount } from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

function createEmptyOperators(puzzle: Puzzle): (MathOperator | null)[] {
  const count = getOperatorSlotCount(puzzle);
  return count > 0 ? Array.from({ length: count }, () => null) : [];
}

function applyAnswerResult({
  correct,
  coinReward,
  happinessBoost,
  isReplay,
  recordInteraction,
  setCoinsEarned,
  setWallet,
  setProgress,
  setPet,
  setIsCorrect,
}: {
  correct: boolean;
  coinReward: number;
  happinessBoost: number;
  isReplay: boolean;
  recordInteraction: () => void;
  setCoinsEarned: (value: number) => void;
  setWallet: ReturnType<typeof useGame>["setWallet"];
  setProgress: ReturnType<typeof useGame>["setProgress"];
  setPet: ReturnType<typeof useGame>["setPet"];
  setIsCorrect: (value: boolean) => void;
}) {
  recordInteraction();
  setIsCorrect(correct);

  if (correct) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setCoinsEarned(coinReward);
    setWallet((current) => ({ coins: current.coins + coinReward }));
    setProgress((current) => ({
      ...current,
      puzzleStreak: isReplay ? current.puzzleStreak : current.puzzleStreak + 1,
    }));
    setPet((current) =>
      withPetCareUpdate(current, (stats) => ({
        ...stats,
        hunger: clampStat(stats.hunger - PUZZLE_HUNGER_COST),
        happiness: clampStat(stats.happiness + happinessBoost),
      })),
    );
    return;
  }

  triggerHaptic();
  setProgress((current) => ({
    ...current,
    lives: loseLife(current.lives),
    puzzleStreak: isReplay ? current.puzzleStreak : 0,
  }));
  setPet((current) =>
    withPetCareUpdate(current, (stats) => ({
      ...stats,
      hunger: clampStat(stats.hunger - PUZZLE_HUNGER_COST),
      happiness: clampStat(stats.happiness - PUZZLE_WRONG_HAPPINESS_PENALTY),
    })),
  );
}

export default function PlayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
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
    rawIndex !== undefined && rawIndex !== ""
      ? Number.parseInt(rawIndex, 10)
      : NaN;
  const {
    pet,
    setPet,
    wallet,
    isReady,
    buyLife,
    progress,
    setWallet,
    setProgress,
    hasCompletedOnboarding,
    recordInteraction,
    purchaseVisualHelp,
  } = useGame();

  const puzzles = getPuzzlesByDifficulty(locale, difficulty);
  const savedIndex = progress.puzzlesSolved[difficulty];
  const sessionIndex = Number.isFinite(parsedIndex) ? parsedIndex : savedIndex;
  const isReplay =
    replayParam === "true" ||
    (Number.isFinite(parsedIndex) && parsedIndex < savedIndex);
  const puzzle = useMemo(
    () => getPuzzleForSession(locale, difficulty, sessionIndex),
    [difficulty, locale, sessionIndex],
  );

  const puzzleNumber = sessionIndex + 1;
  const coinReward = getPuzzleCoinReward(difficulty, isReplay);
  const happinessBoost = isReplay
    ? PUZZLE_REPLAY_HAPPINESS_BOOST
    : PUZZLE_HAPPINESS_BOOST;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedOperators, setSelectedOperators] = useState<(MathOperator | null)[]>(
    () => createEmptyOperators(puzzle),
  );
  const [operatorSubmitted, setOperatorSubmitted] = useState(false);
  const [fractionPieces, setFractionPieces] = useState(0);
  const [numberLineValue, setNumberLineValue] = useState<number | null>(null);
  const [pairIndices, setPairIndices] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [showVisualHelp, setShowVisualHelp] = useState(false);

  const visualHelpCost = getVisualHelpCost(difficulty);
  const visualHelpUnlocked = progress.visualHelpsUnlocked.includes(puzzle.id);
  const hasVisualHelp = hasVisualExplanation(puzzle.id);

  const syncedLives = useMemo(
    () => applyLifeRegen(progress.lives),
    [progress.lives],
  );
  const hasLives = syncedLives.current > 0;
  const answered =
    selectedIndex !== null ||
    operatorSubmitted ||
    numberLineValue !== null ||
    pairIndices.length === 2;
  const resultMood: PetAnimationState = isCorrect ? "correct" : "sad";

  useEffect(() => {
    setSelectedIndex(null);
    setSelectedOperators(createEmptyOperators(puzzle));
    setOperatorSubmitted(false);
    setFractionPieces(0);
    setNumberLineValue(null);
    setPairIndices([]);
    setIsCorrect(false);
    setCoinsEarned(0);
    setShowVisualHelp(false);
  }, [difficulty, sessionIndex, puzzle]);

  const handleOpenVisualHelp = useCallback(() => {
    if (answered || !hasVisualHelp) return;
    recordInteraction();
    triggerHaptic();
    setShowVisualHelp(true);
  }, [answered, hasVisualHelp, recordInteraction]);

  const handlePurchaseVisualHelp = useCallback(() => {
    recordInteraction();
    return purchaseVisualHelp(puzzle.id, visualHelpCost);
  }, [purchaseVisualHelp, puzzle.id, recordInteraction, visualHelpCost]);

  const exitToPath = useCallback(
    (options?: { tierJustCompleted?: boolean }) => {
      recordInteraction();
      let pathDifficulty = difficulty;
      if (options?.tierJustCompleted) {
        const projectedSolved = {
          ...progress.puzzlesSolved,
          [difficulty]: progress.puzzlesSolved[difficulty] + 1,
        };
        pathDifficulty =
          getNextIncompleteDifficulty(locale, projectedSolved, difficulty) ??
          difficulty;
      }
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace({
        pathname: "/puzzles",
        params: { difficulty: pathDifficulty },
      });
    },
    [difficulty, locale, progress.puzzlesSolved, recordInteraction, router],
  );

  const handleExitToPath = useCallback(() => {
    exitToPath();
  }, [exitToPath]);

  const handleChoice = useCallback(
    (index: number) => {
      if (answered) return;
      const correct = checkPuzzleAnswer(puzzle, { kind: "choice", index });
      setSelectedIndex(index);
      applyAnswerResult({
        correct,
        coinReward,
        happinessBoost,
        isReplay,
        recordInteraction,
        setCoinsEarned,
        setWallet,
        setProgress,
        setPet,
        setIsCorrect,
      });
    },
    [
      answered,
      coinReward,
      happinessBoost,
      isReplay,
      puzzle,
      recordInteraction,
      setPet,
      setProgress,
      setWallet,
    ],
  );

  const handleSelectOperator = useCallback(
    (stepIndex: number, operator: MathOperator) => {
      if (answered) return;
      setSelectedOperators((current) => {
        const next = [...current];
        next[stepIndex] = operator;
        return next;
      });
    },
    [answered],
  );

  const handleCheckOperators = useCallback(() => {
    if (answered) return;
    const operators = selectedOperators.filter(
      (operator): operator is MathOperator => operator !== null,
    );
    if (operators.length !== selectedOperators.length) return;

    const correct = checkPuzzleAnswer(puzzle, {
      kind: "operators",
      operators,
    });
    setOperatorSubmitted(true);
    applyAnswerResult({
      correct,
      coinReward,
      happinessBoost,
      isReplay,
      recordInteraction,
      setCoinsEarned,
      setWallet,
      setProgress,
      setPet,
      setIsCorrect,
    });
  }, [
    answered,
    coinReward,
    happinessBoost,
    isReplay,
    puzzle,
    recordInteraction,
    selectedOperators,
    setPet,
    setProgress,
    setWallet,
  ]);

  const handleChangeFractionPieces = useCallback(
    (count: number) => {
      if (answered) return;
      setFractionPieces(count);
    },
    [answered],
  );

  const handleCheckFraction = useCallback(() => {
    if (answered) return;

    const correct = checkPuzzleAnswer(puzzle, {
      kind: "fraction",
      shaded: fractionPieces,
    });
    setOperatorSubmitted(true);
    applyAnswerResult({
      correct,
      coinReward,
      happinessBoost,
      isReplay,
      recordInteraction,
      setCoinsEarned,
      setWallet,
      setProgress,
      setPet,
      setIsCorrect,
    });
  }, [
    answered,
    coinReward,
    fractionPieces,
    happinessBoost,
    isReplay,
    puzzle,
    recordInteraction,
    setPet,
    setProgress,
    setWallet,
  ]);

  const handleSelectNumberLineValue = useCallback(
    (value: number) => {
      if (answered) return;
      const correct = checkPuzzleAnswer(puzzle, { kind: "value", value });
      setNumberLineValue(value);
      applyAnswerResult({
        correct,
        coinReward,
        happinessBoost,
        isReplay,
        recordInteraction,
        setCoinsEarned,
        setWallet,
        setProgress,
        setPet,
        setIsCorrect,
      });
    },
    [
      answered,
      coinReward,
      happinessBoost,
      isReplay,
      puzzle,
      recordInteraction,
      setPet,
      setProgress,
      setWallet,
    ],
  );

  const handleTogglePairIndex = useCallback(
    (index: number) => {
      if (answered) return;

      let next: number[];
      if (pairIndices.includes(index)) {
        next = pairIndices.filter((i) => i !== index);
      } else if (pairIndices.length >= 2) {
        next = [index];
      } else {
        next = [...pairIndices, index];
      }

      setPairIndices(next);

      if (next.length === 2) {
        const correct = checkPuzzleAnswer(puzzle, {
          kind: "pair",
          indices: [next[0], next[1]],
        });
        applyAnswerResult({
          correct,
          coinReward,
          happinessBoost,
          isReplay,
          recordInteraction,
          setCoinsEarned,
          setWallet,
          setProgress,
          setPet,
          setIsCorrect,
        });
      }
    },
    [
      answered,
      coinReward,
      happinessBoost,
      isReplay,
      pairIndices,
      puzzle,
      recordInteraction,
      setPet,
      setProgress,
      setWallet,
    ],
  );

  const handleContinue = useCallback(() => {
    recordInteraction();
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
        exitToPath({ tierJustCompleted: true });
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
      setSelectedOperators(createEmptyOperators(puzzle));
      setOperatorSubmitted(false);
      setFractionPieces(0);
      setNumberLineValue(null);
      setPairIndices([]);
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
    recordInteraction,
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
    if (isReplay) {
      exitToPath();
      return;
    }
    if (isCorrect && sessionIndex + 1 >= puzzles.length) {
      exitToPath({ tierJustCompleted: true });
      return;
    }
    router.replace("/");
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
    return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  }

  if (!canPlayPuzzleIndex(sessionIndex, savedIndex)) {
    return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  }

  if (!hasLives) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              onPress={handleExitToPath}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t("play.a11yBack")}
            >
              <Text style={styles.backText}>{t("common.back")}</Text>
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
            onPress={handleExitToPath}
            disabled={answered}
            style={[styles.backBtn, answered && styles.backBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("play.a11yBack")}
            accessibilityState={{ disabled: answered }}
          >
            <Text
              style={[styles.backText, answered && styles.backTextDisabled]}
            >
              {t("common.back")}
            </Text>
          </Pressable>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <Text style={styles.title}>
          {isReplay
            ? t("play.replayNut", { number: puzzleNumber })
            : t("play.solveFor", { name: pet.name })}
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

          {hasVisualHelp ? (
            <Pressable
              style={[
                styles.visualHelpBtn,
                answered && styles.visualHelpBtnDisabled,
              ]}
              onPress={handleOpenVisualHelp}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={t("visualHelp.a11yOpen")}
            >
              <Text style={styles.visualHelpBtnText}>
                {visualHelpUnlocked
                  ? t("visualHelp.watchFree")
                  : t("visualHelp.watchButton")}
              </Text>
              {!visualHelpUnlocked ? (
                <Text style={styles.visualHelpBtnHint}>
                  {t("visualHelp.unlockPrice", { cost: visualHelpCost })}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.taskArea}>
            <PuzzleTaskView
              puzzle={puzzle}
              selectedIndex={selectedIndex}
              selectedOperators={selectedOperators}
              fractionPieces={fractionPieces}
              numberLineValue={numberLineValue}
              pairIndices={pairIndices}
              answered={answered}
              isCorrect={isCorrect}
              onSelectChoice={handleChoice}
              onSelectOperator={handleSelectOperator}
              onCheckOperators={handleCheckOperators}
              onChangeFractionPieces={handleChangeFractionPieces}
              onCheckFraction={handleCheckFraction}
              onSelectNumberLineValue={handleSelectNumberLineValue}
              onTogglePairIndex={handleTogglePairIndex}
            />
          </View>
        </ScrollView>

        {answered ? (
          <ResultOverlay
            visible
            correct={isCorrect}
            petType={pet.type}
            catSkinId={pet.catSkinId}
            petMood={resultMood}
            message={
              isCorrect
                ? isReplay
                  ? t("play.crackedAgain")
                  : t("play.greatJob")
                : t("play.goodTry")
            }
            detail={isCorrect ? puzzle.explanation : puzzle.hint}
            coinsEarned={coinsEarned}
            coinType={isReplay ? "sparkle" : "regular"}
            continueLabel={
              isCorrect
                ? isReplay
                  ? t("play.backToPath")
                  : t("play.nextPuzzle")
                : canRetry
                  ? t("play.tryAgain")
                  : t("play.backToPath")
            }
            onContinue={handleContinue}
            onGoHome={isCorrect && !isReplay ? handleGoHome : undefined}
            onBuyLife={!isCorrect && !canRetry ? buyLife : undefined}
            buyLifeCost={LIFE_BUY_COST}
            coins={wallet.coins}
          />
        ) : null}

        {showVisualHelp ? (
          <VisualHelpSheet
            visible
            puzzleId={puzzle.id}
            cost={visualHelpCost}
            coins={wallet.coins}
            unlocked={visualHelpUnlocked}
            onPurchase={handlePurchaseVisualHelp}
            onClose={() => setShowVisualHelp(false)}
          />
        ) : null}
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
    backgroundColor: GameColors.background,
  },
  scrollContent: {
    flexGrow: 0,
    gap: moderateScale(16),
    paddingBottom: moderateScale(24),
  },
  taskArea: {
    flexGrow: 0,
    alignSelf: "stretch",
  },
  visualHelpBtn: {
    backgroundColor: "#F3EEFF",
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: "#C9B6FF",
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    alignItems: "center",
    gap: moderateScale(2),
  },
  visualHelpBtnDisabled: {
    opacity: 0.45,
  },
  visualHelpBtnText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: "#6B4FCF",
  },
  visualHelpBtnHint: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.coinText,
  },
});
