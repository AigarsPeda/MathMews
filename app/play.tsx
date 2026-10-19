import { getStoreCoinPrice } from "@/utils/store-catalog";
import { useStoreCatalog } from "@/hooks/use-store-catalog";
import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { PuzzleTaskView } from "@/components/puzzle/PuzzleTaskView";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { VisualHelpSheet } from "@/components/puzzle/VisualHelpSheet";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { IconText as Text } from "@/components/ui/IconText";
import {
  GameColors,
  getPuzzleCoinReward,
  getVisualHelpCost,
} from "@/constants/game";
import { isPuzzleDifficulty } from "@/constants/puzzles";
import { getLevelPuzzles, getNextPracticeLevel, resolveLearningSession, type LearningSession } from "@/constants/curriculum";
import { hasVisualExplanation } from "@/constants/visual-explanations";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import type { PetAnimationState } from "@/types/game";
import type { MathOperator, Puzzle, PuzzleDifficulty } from "@/types/puzzle";
import {
  buildFractionMatchCards,
  isFractionMatchPair,
} from "@/utils/fraction-match";
import { shufflePuzzleChoices } from "@/utils/puzzle-practice";
import {
  asFractionMatchPuzzle,
  asOrderNumbersPuzzle,
  checkPuzzleAnswer,
  getOperatorSlotCount,
  getPuzzleType,
} from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import type { ChallengeAnswer } from "@/utils/challenge-puzzles";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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

function shuffleNumbers(values: number[], seed: string): number[] {
  const next = [...values];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  for (let i = next.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) | 0;
    const j = Math.abs(hash) % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  if (next.every((value, index) => value === values[index])) {
    [next[0], next[1]] = [next[1], next[0]];
  }
  return next;
}

function createInitialOrder(puzzle: Puzzle): number[] {
  const orderPuzzle = asOrderNumbersPuzzle(puzzle);
  if (!orderPuzzle) return [];
  return shuffleNumbers(orderPuzzle.payload.numbers, puzzle.id);
}

function applyAnswerResult({
  correct,
  puzzle,
  attemptId,
  answerPuzzle,
  setCoinsEarned,
  setIsCorrect,
}: {
  correct: boolean;
  puzzle: Puzzle;
  attemptId: string;
  answerPuzzle: ReturnType<typeof useGame>["answerPuzzle"];
  setCoinsEarned: (value: number) => void;
  setIsCorrect: (value: boolean) => void;
}) {
  triggerHaptic(
    correct
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light,
  );
  setIsCorrect(correct);
  setCoinsEarned(answerPuzzle(puzzle, correct, attemptId));
}

export default function PlayScreen() {
  const { isReady } = useGame();
  const params = useLocalSearchParams<{ difficulty?: string; lesson?: string; level?: string; phase?: string }>();
  const { locale } = useLocale();
  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  const difficulty: PuzzleDifficulty = isPuzzleDifficulty(params.difficulty ?? "") ? params.difficulty as PuzzleDifficulty : "easy";
  return <LearningPlayGate key={`${locale}-${difficulty}-${params.lesson}-${params.level}-${params.phase}`}
    difficulty={difficulty} lessonId={params.lesson} levelId={params.level} phaseParam={params.phase} />;
}

function LearningPlayGate({ difficulty, lessonId, levelId, phaseParam }: {
  difficulty: PuzzleDifficulty; lessonId?: string; levelId?: string; phaseParam?: string;
}) {
  const { progress, hasCompletedOnboarding } = useGame();
  // Freeze entry context. Recording a successful stage must not advance the task
  // until the child dismisses its result, nor turn its first reward into a replay.
  const [session] = useState(() => resolveLearningSession(difficulty, lessonId, levelId, phaseParam, progress.completedPuzzleIds ?? []));
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if (!session) return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  return <PlaySession session={session} />;
}

function PlaySession({ session }: { session: LearningSession }) {
  useStoreCatalog();
  const lifeBuyCost = getStoreCoinPrice("life", "one")!;
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lesson, level, phase: sessionIndex } = session;
  const difficulty = lesson.difficulty;
  const { pet, answerPuzzle, wallet, isReady, progress, hasCompletedOnboarding, recordInteraction, purchaseVisualHelp } = useGame();
  const puzzles = getLevelPuzzles(locale, lesson, level);
  const [entryCompleted] = useState(progress.completedPuzzleIds ?? []);
  const [initialAttemptId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const attemptId = useRef(initialAttemptId);
  const isReplay = entryCompleted.includes(puzzles[sessionIndex].id);
  const [puzzle, setPuzzle] = useState(() => shufflePuzzleChoices(puzzles[sessionIndex],
    `${level.id}-${sessionIndex}-${progress.puzzleStreak}`));
  const puzzleNumber = level.kind === "practice" ? lesson.levels.findIndex(item => item.id === level.id) + 1 : sessionIndex + 1;
  const coinReward = getPuzzleCoinReward(difficulty, isReplay);
  const [foundPairs, setFoundPairs] = useState<[number, number][]>([]);
  const [isDraggingChallenge, setIsDraggingChallenge] = useState(false);

  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [pendingNumberLine, setPendingNumberLine] = useState<number | null>(
    null,
  );
  const [pairSubmitted, setPairSubmitted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedOperators, setSelectedOperators] = useState<
    (MathOperator | null)[]
  >(() => createEmptyOperators(puzzle));
  const [operatorSubmitted, setOperatorSubmitted] = useState(false);
  const [fractionPieces, setFractionPieces] = useState(0);
  const [numberLineValue, setNumberLineValue] = useState<number | null>(null);
  const [pairIndices, setPairIndices] = useState<number[]>([]);
  const [numberOrder, setNumberOrder] = useState<number[]>(() =>
    createInitialOrder(puzzle),
  );
  const [orderSwapIndex, setOrderSwapIndex] = useState<number | null>(null);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [fractionMatchMatchedIds, setFractionMatchMatchedIds] = useState<
    string[]
  >([]);
  const [fractionMatchSelectedId, setFractionMatchSelectedId] = useState<
    string | null
  >(null);
  const [fractionMatchWrongIds, setFractionMatchWrongIds] = useState<string[]>(
    [],
  );
  const [fractionMatchAnswered, setFractionMatchAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [showVisualHelp, setShowVisualHelp] = useState(false);

  const visualHelpCost = getVisualHelpCost(difficulty);
  const visualHelpUnlocked = true;
  const hasVisualHelp = hasVisualExplanation(puzzle);

  const answered =
    selectedIndex !== null ||
    operatorSubmitted ||
    numberLineValue !== null ||
    pairSubmitted ||
    orderSubmitted ||
    fractionMatchAnswered;
  const resultMood: PetAnimationState = isCorrect ? "correct" : "incorrect";

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

  const exitToPath = useCallback(() => {
    router.dismissTo({ pathname: "/puzzles", params: { difficulty, topic: lesson.topicId, lesson: lesson.id } });
  }, [difficulty, lesson.id, lesson.topicId, router]);

  const handleCheckPairs = useCallback(() => {
    if (answered) return;
    const correct = checkPuzzleAnswer(puzzle, { kind: "pairs", pairs: foundPairs });
    setOperatorSubmitted(true);
    applyAnswerResult({ correct, puzzle, attemptId: attemptId.current, answerPuzzle, setCoinsEarned, setIsCorrect });
  }, [answered, puzzle, foundPairs, answerPuzzle]);

  const handleSubmitChallenge = useCallback((answer: ChallengeAnswer) => {
    if (answered) return;
    const correct = checkPuzzleAnswer(puzzle, answer);
    setOperatorSubmitted(true);
    applyAnswerResult({ correct, puzzle, attemptId: attemptId.current, answerPuzzle, setCoinsEarned, setIsCorrect });
  }, [answered, puzzle, answerPuzzle]);

  const handleExitToPath = useCallback(() => {
    exitToPath();
  }, [exitToPath]);

  const handleChoice = useCallback(
    (index: number) => {
      if (answered) return;
      const correct = checkPuzzleAnswer(puzzle, { kind: "choice", index });
      setSelectedIndex(index);
      applyAnswerResult({
        correct: correct,
        puzzle,
        attemptId: attemptId.current,
        answerPuzzle,
        setCoinsEarned,
        setIsCorrect,
      });
    },
    [answered, puzzle, answerPuzzle],
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
      correct: correct,
      puzzle,
      attemptId: attemptId.current,
      answerPuzzle,
      setCoinsEarned,
      setIsCorrect,
    });
  }, [answered, puzzle, selectedOperators, answerPuzzle]);

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
      correct: correct,
      puzzle,
      attemptId: attemptId.current,
      answerPuzzle,
      setCoinsEarned,
      setIsCorrect,
    });
  }, [answered, fractionPieces, puzzle, answerPuzzle]);

  const handleSelectNumberLineValue = useCallback(
    (value: number) => {
      if (answered) return;
      const correct = checkPuzzleAnswer(puzzle, { kind: "value", value });
      setNumberLineValue(value);
      applyAnswerResult({
        correct: correct,
        puzzle,
        attemptId: attemptId.current,
        answerPuzzle,
        setCoinsEarned,
        setIsCorrect,
      });
    },
    [answered, puzzle, answerPuzzle],
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
    },
    [answered, pairIndices],
  );

  const handleCheckPair = useCallback(() => {
    if (answered || pairIndices.length !== 2) return;
    const correct = checkPuzzleAnswer(puzzle, {
      kind: "pair",
      indices: [pairIndices[0], pairIndices[1]],
    });
    setPairSubmitted(true);
    applyAnswerResult({
      correct,
      puzzle,
      attemptId: attemptId.current,
      answerPuzzle,
      setCoinsEarned,
      setIsCorrect,
    });
  }, [answered, pairIndices, puzzle, answerPuzzle]);

  const handleTapOrderIndex = useCallback(
    (index: number) => {
      if (answered) return;

      if (orderSwapIndex === null) {
        setOrderSwapIndex(index);
        return;
      }

      if (orderSwapIndex === index) {
        setOrderSwapIndex(null);
        return;
      }

      setNumberOrder((current) => {
        const next = [...current];
        [next[orderSwapIndex], next[index]] = [
          next[index],
          next[orderSwapIndex],
        ];
        return next;
      });
      setOrderSwapIndex(null);
    },
    [answered, orderSwapIndex],
  );

  const handleCheckOrder = useCallback(() => {
    if (answered) return;

    const correct = checkPuzzleAnswer(puzzle, {
      kind: "order",
      numbers: numberOrder,
    });
    setOrderSubmitted(true);
    applyAnswerResult({
      correct: correct,
      puzzle,
      attemptId: attemptId.current,
      answerPuzzle,
      setCoinsEarned,
      setIsCorrect,
    });
  }, [answered, numberOrder, puzzle, answerPuzzle]);

  const handleTapFractionMatchCard = useCallback(
    (cardId: string) => {
      if (fractionMatchAnswered) return;

      const matchPuzzle = asFractionMatchPuzzle(puzzle);
      if (!matchPuzzle) return;

      if (fractionMatchMatchedIds.includes(cardId)) return;

      if (fractionMatchSelectedId === null) {
        setFractionMatchWrongIds([]);
        setFractionMatchSelectedId(cardId);
        return;
      }

      if (fractionMatchSelectedId === cardId) {
        setFractionMatchSelectedId(null);
        return;
      }

      const cards = buildFractionMatchCards(matchPuzzle);
      const first = cards.find((card) => card.id === fractionMatchSelectedId);
      const second = cards.find((card) => card.id === cardId);
      if (!first || !second) return;

      if (isFractionMatchPair(first, second)) {
        const nextMatched = [...fractionMatchMatchedIds, first.id, second.id];
        setFractionMatchMatchedIds(nextMatched);
        setFractionMatchSelectedId(null);

        if (nextMatched.length === matchPuzzle.payload.pairs.length * 2) {
          const correct = checkPuzzleAnswer(puzzle, {
            kind: "fraction_match",
            matchedCount: matchPuzzle.payload.pairs.length,
          });
          setFractionMatchAnswered(true);
          applyAnswerResult({
            correct: correct,
            puzzle,
            attemptId: attemptId.current,
            answerPuzzle,
            setCoinsEarned,
            setIsCorrect,
          });
        }
        return;
      }

      setFractionMatchWrongIds([first.id, second.id]);
      setFractionMatchSelectedId(null);
      triggerHaptic();
    },
    [
      fractionMatchAnswered,
      fractionMatchMatchedIds,
      fractionMatchSelectedId,
      puzzle,
      answerPuzzle,
    ],
  );

  const handleContinue = useCallback(() => {
    recordInteraction();
    if (isCorrect) {
      if (level.kind === "boss" && sessionIndex + 1 < puzzles.length) {
        router.replace({ pathname: "/play", params: { difficulty, lesson: lesson.id, level: level.id, phase: String(sessionIndex + 1) } });
        return;
      }
      const next = !isReplay && getNextPracticeLevel(lesson, level);
      if (next) {
        router.replace({ pathname: "/play", params: { difficulty, lesson: lesson.id, level: next.id } });
      } else exitToPath();
      return;
    }

    if (!isCorrect) {
      attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPuzzle((current) =>
        shufflePuzzleChoices(
          current,
          `${current.id}-${Date.now()}-${Math.random()}`,
        ),
      );
      setPendingChoice(null);
      setPendingNumberLine(null);
      setPairSubmitted(false);
      setSelectedIndex(null);
      setSelectedOperators(createEmptyOperators(puzzle));
      setOperatorSubmitted(false);
      setFractionPieces(0);
      setNumberLineValue(null);
      setPairIndices([]);
      setNumberOrder(createInitialOrder(puzzle));
      setOrderSwapIndex(null);
      setOrderSubmitted(false);
      setFractionMatchMatchedIds([]);
      setFractionMatchSelectedId(null);
      setFractionMatchWrongIds([]);
      setFractionMatchAnswered(false);
      setIsCorrect(false);
      setCoinsEarned(0);
      return;
    }
  }, [
    difficulty,
    lesson,
    level,
    exitToPath,
    isCorrect,
    isReplay,
    puzzles.length,
    recordInteraction,
    router,
    sessionIndex,
    puzzle,
    setPuzzle,
  ]);

  const handleGoHome = useCallback(() => { router.dismissTo("/"); }, [router]);

  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;

  const canRetry = true;
  const replayingMission = level.kind === "boss" && level.puzzleIds.every(id => entryCompleted.includes(id));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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
            <BackButtonLabel
              style={[styles.backText, answered && styles.backTextDisabled]}
            />
          </Pressable>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <Text style={styles.title}>{level.kind === "practice" ? lesson.title[locale] : level.title[locale]}</Text>

        <ScrollView
          scrollEnabled={!isDraggingChallenge}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {level.kind !== "practice" && <View style={[styles.mission, level.kind === "boss" ? styles.bossMission : styles.challengeMission]}>
            <Text style={styles.missionTitle}>{t(`learning.${level.kind}`)}</Text>
            <Text style={styles.missionDescription}>{level.description[locale]}</Text>
            {level.kind === "boss" && <>
              <Text style={styles.missionTitle}>{t("learning.stageOf", { number: sessionIndex + 1, total: puzzles.length })}</Text>
              <View style={styles.stageRow}>{puzzles.map((stage, index) => {
                const done = replayingMission ? index < sessionIndex || index === sessionIndex && answered && isCorrect
                  : (progress.completedPuzzleIds ?? []).includes(stage.id);
                return <View key={stage.id} style={[styles.stageMarker, done && styles.stageMarkerDone]}>
                  <Text style={styles.missionDescription}>{t(done ? "learning.stageDone" : index === sessionIndex ? "learning.stageActive" : "learning.stagePending", { number: index + 1 })}</Text>
                </View>;
              })}</View>
              <Text style={styles.missionDescription}>{t("learning.stagesSaved")}</Text>
            </>}
          </View>}
          <PuzzleCard
            puzzle={puzzle}
            puzzleNumber={puzzleNumber}
            coinReward={coinReward}
            levelKind={level.kind}
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
                {t("visualHelp.watchButton")}
              </Text>
              {!visualHelpUnlocked ? (
                <Text style={styles.visualHelpBtnHint}>
                  {t("visualHelp.unlockPrice", { cost: visualHelpCost })}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.taskArea}>
            {!(progress.completedPuzzleIds ?? []).some(
              (id) =>
                puzzles.find((item) => item.id === id)?.type === puzzle.type,
            ) && (
              <Text style={styles.mechanicIntro}>
                {t(`play.mechanicIntro.${getPuzzleType(puzzle)}`)}
              </Text>
            )}
            <PuzzleTaskView
              puzzle={puzzle}
              onSubmitChallenge={handleSubmitChallenge}
              onChallengeDragStateChange={setIsDraggingChallenge}
              selectedIndex={selectedIndex ?? pendingChoice}
              selectedOperators={selectedOperators}
              fractionPieces={fractionPieces}
              numberLineValue={numberLineValue ?? pendingNumberLine}
              pairIndices={pairIndices}
              foundPairs={foundPairs}
              onFoundPairsChange={setFoundPairs}
              onCheckPairs={handleCheckPairs}
              numberOrder={numberOrder}
              orderSwapIndex={orderSwapIndex}
              orderSubmitted={orderSubmitted}
              fractionMatchMatchedIds={fractionMatchMatchedIds}
              fractionMatchSelectedId={fractionMatchSelectedId}
              fractionMatchWrongIds={fractionMatchWrongIds}
              fractionMatchAnswered={fractionMatchAnswered}
              answered={answered}
              isCorrect={isCorrect}
              onSelectChoice={setPendingChoice}
              onSelectOperator={handleSelectOperator}
              onCheckOperators={handleCheckOperators}
              onChangeFractionPieces={handleChangeFractionPieces}
              onCheckFraction={handleCheckFraction}
              onSelectNumberLineValue={setPendingNumberLine}
              onTogglePairIndex={handleTogglePairIndex}
              onTapOrderIndex={handleTapOrderIndex}
              onCheckOrder={handleCheckOrder}
              onTapFractionMatchCard={handleTapFractionMatchCard}
            />

            {!answered &&
            (pendingChoice !== null ||
              pendingNumberLine !== null ||
              pairIndices.length === 2) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (pendingChoice !== null) handleChoice(pendingChoice);
                  else if (pendingNumberLine !== null)
                    handleSelectNumberLineValue(pendingNumberLine);
                  else handleCheckPair();
                }}
                style={styles.checkAnswer}
              >
                <Text style={styles.checkAnswerText}>
                  {t("play.checkAnswer")}
                </Text>
              </Pressable>
            ) : null}
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
                ? level.kind === "boss" && sessionIndex === puzzles.length - 1
                  ? t("learning.bossComplete")
                  : level.kind === "challenge" ? t("learning.challengeComplete")
                  : isReplay
                  ? t("play.crackedAgain")
                  : t("play.greatJob")
                : t("play.goodTry")
            }
            detail={isCorrect ? puzzle.explanation : puzzle.hint}
            coinsEarned={coinsEarned}
            coinType={isReplay ? "sparkle" : "regular"}
            continueLabel={isCorrect
              ? level.kind === "boss" && sessionIndex + 1 < puzzles.length ? t("learning.nextStage")
                : level.kind !== "practice" || isReplay || !getNextPracticeLevel(lesson, level) ? t("learning.backToLesson") : t("play.nextPuzzle")
              : canRetry ? t("play.tryAgain") : t("learning.backToLesson")}
            onContinue={handleContinue}
            onGoHome={isCorrect && !isReplay ? handleGoHome : undefined}
            onBuyLife={undefined}
            buyLifeCost={lifeBuyCost}
            coins={wallet.coins}
          />
        ) : null}

        {showVisualHelp ? (
          <VisualHelpSheet
            visible
            puzzle={puzzle}
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
  mission: { padding: moderateScale(16), gap: moderateScale(10), borderRadius: moderateScale(16), borderWidth: 2, marginBottom: moderateScale(16) },
  bossMission: { backgroundColor: "#FFF3D9", borderColor: "#C99632" },
  challengeMission: { backgroundColor: "#F3EEFF", borderColor: "#BBA4E6" },
  missionTitle: { color: GameColors.text, fontSize: moderateScale(17), fontWeight: "800" },
  missionDescription: { color: GameColors.text, fontSize: moderateScale(15), lineHeight: moderateScale(22) },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(8) },
  stageMarker: { padding: moderateScale(8), backgroundColor: GameColors.card, borderRadius: moderateScale(10) },
  stageMarkerDone: { backgroundColor: "#D9EFDF" },
  mechanicIntro: {
    color: GameColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  checkAnswer: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  checkAnswerText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
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
    paddingBottom: moderateScale(4),
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
