import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { PuzzleTaskView } from "@/components/puzzle/PuzzleTaskView";
import { BossStoryScene } from "@/components/puzzle/BossStoryScene";
import { getPuzzleAttemptHint, getPuzzleDraftAnswer, getPuzzlePosition } from "@/utils/puzzle-attempt";
import { getBossSceneProgress } from "@/utils/boss-story";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { PuzzleProgress } from "@/components/puzzle/PuzzleProgress";
import { PuzzleLives } from "@/components/puzzle/PuzzleLives";
import { ChallengeClock, TimedChallengeActions, TimedChallengeIntro } from "@/components/puzzle/TimedChallenge";
import { BuyLifeSheet } from "@/components/economy/BuyLifeSheet";
import { PuzzleCatPortrait } from "@/components/puzzle/PuzzleCatPortrait";
import { VisualHelpSheet } from "@/components/puzzle/VisualHelpSheet";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { IconText as Text } from "@/components/ui/IconText";
import {
  GameColors,
  getPuzzleCoinReward,
  getVisualHelpCost,
  MAX_LIVES,
} from "@/constants/game";
import { isPuzzleDifficulty } from "@/constants/puzzles";
import { getLearningLevelLocation, getLevelPuzzles, getNextPracticeLevel, getNextSpecialLevel, getRequiredIds, resolveLearningSession, type LearningSession } from "@/constants/curriculum";
import { isChallengeOpen } from "@/utils/timed-challenge";
import { hasVisualExplanation } from "@/constants/visual-explanations";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import type { PetAnimationState } from "@/types/game";
import type { MathOperator, Puzzle, PuzzleDifficulty } from "@/types/puzzle";
import {
  buildFractionMatchCards,
  isFractionMatchPair,
} from "@/utils/fraction-match";
import { moveOrderTile } from "@/utils/puzzle-drag";
import { resizeFractionSelection, toggleFractionSlice } from "@/utils/fraction-pie";
import { getPuzzleCompanionMessage } from "@/utils/puzzle-companion";
import { shufflePuzzleChoices } from "@/utils/puzzle-practice";
import { applyLifeRegen, formatRegenCountdown, msUntilNextLife } from "@/utils/lives";
import { useWorldClockNow } from "@/hooks/use-world-clock-now";
import {
  asFractionBuildPuzzle,
  asFractionMatchPuzzle,
  asOrderNumbersPuzzle,
  checkPuzzleAnswer,
  getOperatorSlotCount,
  getPuzzleType,
} from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import type { ChallengeAnswer } from "@/utils/challenge-puzzles";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { NativeStackNavigationProp } from "expo-router/native-stack";
import type { ParamListBase } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const coins = answerPuzzle(puzzle, correct, attemptId);
  if (coins === null) return false;
  triggerHaptic(
    correct
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light,
  );
  setIsCorrect(correct);
  setCoinsEarned(coins);
  return true;
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

export function PlaySession({ session }: { session: LearningSession }) {
  const router = useRouter();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lesson, level, phase: sessionIndex } = session;
  const difficulty = lesson.difficulty;
  const { pet, recordLearningHelp, answerPuzzle, buyLife, wallet, isReady, progress, hasCompletedOnboarding, recordInteraction, purchaseVisualHelp, beginChallenge, expireChallenge } = useGame();
  const run = progress.challengeAttempt;
  const timed = level.kind === "challenge" && !!level.timeLimitSeconds;
  const now = useWorldClockNow(1000, progress.lives.current < MAX_LIVES || run?.status === "active");
  const lives = applyLifeRegen(progress.lives, now);
  const nextLife = msUntilNextLife(lives, now);
  const hasLives = lives.current > 0;
  const puzzles = getLevelPuzzles(locale, lesson, level);
  const [entryCompleted] = useState(progress.completedPuzzleIds ?? []);
  const [initialAttemptId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const attemptId = useRef(initialAttemptId);
  const isReplay = entryCompleted.includes(puzzles[sessionIndex].id);
  const [puzzle] = useState(() => shufflePuzzleChoices(puzzles[sessionIndex],
    `${level.id}-${sessionIndex}-${progress.puzzleStreak}`));
  const position = useMemo(() => getPuzzlePosition(lesson, level, sessionIndex), [lesson, level, sessionIndex]);
  const puzzleNumber = position.current;
  const coinReward = getPuzzleCoinReward(difficulty, isReplay, level.kind);
  const [foundPairs, setFoundPairs] = useState<[number, number][]>([]);
  const [isDraggingTile, setIsDraggingTile] = useState(false);

  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [pendingNumberLine, setPendingNumberLine] = useState<number | null>(
    null,
  );
  const [selectedOperators, setSelectedOperators] = useState<
    (MathOperator | null)[]
  >(() => createEmptyOperators(puzzle));
  const [answered, setAnswered] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ key: string; hint: string } | null>(null);
  const submittedAnswer = useRef<string | null>(null);
  const matchingAttempt = useRef<string | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState<ChallengeAnswer | null>(null);
  const [fractionSelectedSlices, setFractionSelectedSlices] = useState<number[]>([]);
  const fractionPieces = fractionSelectedSlices.length;
  const [pairIndices, setPairIndices] = useState<number[]>([]);
  const [numberOrder, setNumberOrder] = useState<number[]>(() =>
    createInitialOrder(puzzle),
  );
  const [fractionMatchMatchedIds, setFractionMatchMatchedIds] = useState<
    string[]
  >([]);
  const [fractionMatchSelectedId, setFractionMatchSelectedId] = useState<
    string | null
  >(null);
  const [fractionMatchWrongIds, setFractionMatchWrongIds] = useState<string[]>(
    [],
  );
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [showVisualHelp, setShowVisualHelp] = useState(false);
  const [showLives, setShowLives] = useState(false);
  const challengePlayable = !timed || answered || isChallengeOpen(run, puzzle.id, now);
  const otherActive = run?.status === "active" && run.puzzleId !== puzzle.id && now < run.deadlineAt;
  const expired = run?.puzzleId === puzzle.id && (run.status === "expired" || run.status === "active" && now >= run.deadlineAt);

  useEffect(() => {
    if (run?.status === "active" && now >= run.deadlineAt) expireChallenge(run.id);
  }, [run, now, expireChallenge]);

  const handleBeginChallenge = useCallback(() => {
    if (!beginChallenge(level.id)) return;
    recordInteraction();
    setPendingChoice(null); setPendingNumberLine(null); setSelectedOperators(createEmptyOperators(puzzle));
    setChallengeAnswer(null); setFoundPairs([]); setPairIndices([]); setFractionSelectedSlices([]);
    setNumberOrder(createInitialOrder(puzzle)); setFractionMatchMatchedIds([]); setFractionMatchSelectedId(null); setFractionMatchWrongIds([]);
    setLastAttempt(null); setRetryCount(0); setIsDraggingTile(false); setAnswered(false); setIsCorrect(false);
    submittedAnswer.current = null; matchingAttempt.current = null;
    attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [beginChallenge, level.id, puzzle, recordInteraction]);
  const handleResumeChallenge = useCallback(() => {
    const location = run && getLearningLevelLocation(run.levelId);
    if (location) router.replace({ pathname: "/play", params: { difficulty: location.lesson.difficulty, lesson: location.lesson.id, level: location.level.id } });
  }, [run, router]);

  const visualHelpCost = getVisualHelpCost(difficulty);
  const visualHelpUnlocked = true;
  const hasVisualHelp = hasVisualExplanation(puzzle);

  const draftAnswer = useMemo(() => getPuzzleDraftAnswer(puzzle, {
    choice: pendingChoice, operators: selectedOperators, shaded: fractionPieces,
    numberLine: pendingNumberLine, pairIndices, order: numberOrder,
    matchedCount: fractionMatchMatchedIds.length / 2, pairs: foundPairs, challenge: challengeAnswer,
  }), [puzzle, pendingChoice, selectedOperators, fractionPieces, pendingNumberLine, pairIndices, numberOrder, fractionMatchMatchedIds.length, foundPairs, challengeAnswer]);
  const draftKey = JSON.stringify(draftAnswer);
  const canCheck = hasLives && challengePlayable && !answered && draftAnswer !== null && draftKey !== lastAttempt?.key;
  const practiceFinished = level.kind === "practice" && !getNextPracticeLevel(lesson, level);
  const progressSteps = level.kind === "practice"
    ? lesson.levels.filter(item => item.kind === "practice").map(item => item.puzzleIds.every(id => entryCompleted.includes(id) || answered && id === puzzle.id))
    : level.puzzleIds.map(id => entryCompleted.includes(id) || answered && id === puzzle.id);
  const lessonFinished = answered && !isReplay && getRequiredIds(lesson).every(id => id === puzzle.id || entryCompleted.includes(id));
  const resultMood: PetAnimationState = isCorrect ? "correct" : "incorrect";
  const nextSpecialLevel = isCorrect ? getNextSpecialLevel(lesson, level, [...entryCompleted, puzzle.id]) : undefined;
  const nextPuzzleRoute = useMemo(() => {
    if (!isCorrect) return undefined;
    if (level.kind === "boss" && sessionIndex + 1 < puzzles.length) {
      return { pathname: "/play" as const, params: { difficulty, lesson: lesson.id, level: level.id, phase: String(sessionIndex + 1) } };
    }
    const next = nextSpecialLevel ?? (!isReplay && getNextPracticeLevel(lesson, level));
    return next ? { pathname: "/play" as const, params: { difficulty, lesson: lesson.id, level: next.id } } : undefined;
  }, [difficulty, isCorrect, isReplay, lesson, level, nextSpecialLevel, puzzles.length, sessionIndex]);

  useEffect(() => {
    // Prepare the destination under the result sheet; navigation still waits for dismissal.
    if (answered && nextPuzzleRoute) router.prefetch(nextPuzzleRoute);
  }, [answered, nextPuzzleRoute, router]);

  const handleOpenVisualHelp = useCallback(() => {
    if (answered || !hasVisualHelp) return;
    recordInteraction();
    triggerHaptic();
    recordLearningHelp(puzzle.id);
    setShowVisualHelp(true);
  }, [answered, hasVisualHelp, recordInteraction, recordLearningHelp, puzzle.id, setShowVisualHelp]);

  const handlePurchaseVisualHelp = useCallback(() => {
    recordInteraction();
    return purchaseVisualHelp(puzzle.id, visualHelpCost);
  }, [purchaseVisualHelp, puzzle.id, recordInteraction, visualHelpCost]);

  const exitToPath = useCallback(() => {
    router.dismissTo({ pathname: "/puzzles", params: { difficulty, topic: lesson.topicId, lesson: lesson.id } });
  }, [difficulty, lesson.id, lesson.topicId, router]);

  const handleCheckAnswer = useCallback(() => {
    if (!canCheck || !draftAnswer || submittedAnswer.current === draftKey) return;
    // Guard duplicate taps before React has painted the disabled button.
    submittedAnswer.current = draftKey;
    const correct = checkPuzzleAnswer(puzzle, draftAnswer);
    if (!applyAnswerResult({ correct, puzzle, attemptId: attemptId.current, answerPuzzle, setCoinsEarned, setIsCorrect })) {
      submittedAnswer.current = null;
      return;
    }
    if (correct) {
      setAnswered(true);
      setLastAttempt(null);
    } else {
      const hint = getPuzzleAttemptHint(puzzle, draftAnswer);
      setLastAttempt({ key: draftKey, hint: hint ? t(`play.attemptHints.${hint.key}`) : puzzle.hint });
      setRetryCount(count => count + 1);
      attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [canCheck, draftAnswer, draftKey, puzzle, answerPuzzle, t]);

  const handleInlineMistake = useCallback(() => {
    const accepted = applyAnswerResult({ correct: false, puzzle,
      attemptId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      answerPuzzle, setCoinsEarned, setIsCorrect });
    if (accepted) setRetryCount(count => count + 1);
    return accepted;
  }, [answerPuzzle, puzzle]);

  // A changed draft permits a new attempt while preserving every placed piece.
  useEffect(() => {
    if (draftKey !== submittedAnswer.current) submittedAnswer.current = null;
  }, [draftKey]);

  const handleExitToPath = useCallback(() => {
    exitToPath();
  }, [exitToPath]);

  const handleSelectOperator = useCallback((stepIndex: number, operator: MathOperator) => {
    if (answered) return;
    setSelectedOperators(current => current.map((value, index) => index === stepIndex ? operator : value));
  }, [answered]);

  const handleChangeFractionPieces = useCallback(
    (count: number) => {
      const fractionPuzzle = asFractionBuildPuzzle(puzzle);
      if (answered || !fractionPuzzle) return;
      setFractionSelectedSlices(selected => resizeFractionSelection(selected, count, fractionPuzzle.payload.denominator));
    },
    [answered, puzzle],
  );

  const handleToggleFractionSlice = useCallback((index: number) => {
    const fractionPuzzle = asFractionBuildPuzzle(puzzle);
    if (answered || !fractionPuzzle || index < 0 || index >= fractionPuzzle.payload.denominator) return;
    setFractionSelectedSlices(selected => toggleFractionSlice(selected, index));
  }, [answered, puzzle]);

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

  const handleMoveOrder = useCallback(
    (from: number, to: number) => {
      if (answered) return;
      setNumberOrder(current => moveOrderTile(current, from, to));
    },
    [answered],
  );

  const handleTapFractionMatchCard = useCallback(
    (cardId: string) => {
      if (answered || !hasLives) return;

      const matchPuzzle = asFractionMatchPuzzle(puzzle);
      if (!matchPuzzle) return;

      if (fractionMatchMatchedIds.includes(cardId)) return;

      if (fractionMatchSelectedId === null) {
        matchingAttempt.current = null;
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
      const key = [first.id, second.id].sort().join(":");
      if (matchingAttempt.current === key) return;
      matchingAttempt.current = key;

      if (isFractionMatchPair(first, second)) {
        const nextMatched = [...fractionMatchMatchedIds, first.id, second.id];
        setFractionMatchMatchedIds(nextMatched);
        setFractionMatchSelectedId(null);

        return;
      }

      if (!handleInlineMistake()) return;
      setFractionMatchWrongIds([first.id, second.id]);
      setFractionMatchSelectedId(null);
    },
    [
      answered,
      fractionMatchMatchedIds,
      fractionMatchSelectedId,
      puzzle,
      hasLives,
      handleInlineMistake,
    ],
  );

  const handleContinue = useCallback(() => {
    if (isCorrect) {
      // Dispatch immediately after dismissal, without a game update or router queue first.
      if (nextPuzzleRoute) navigation.replace("play", nextPuzzleRoute.params);
      else exitToPath();
    }
  }, [nextPuzzleRoute, exitToPath, isCorrect, navigation]);

  const handleGoHome = useCallback(() => { router.dismissTo("/"); }, [router]);

  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;

  const companionMessage = getPuzzleCompanionMessage({
    correct: isCorrect,
    kind: level.kind,
    finalStage: sessionIndex === puzzles.length - 1,
    practiceFinished: level.kind === "practice" && !getNextPracticeLevel(lesson, level),
    replay: isReplay,
    retries: retryCount,
    completedCount: new Set(entryCompleted).size + (isCorrect && !isReplay ? 1 : 0),
    puzzleId: puzzle.id,
  });
  const challengeIntroProps = { level, expired: !!expired, lifeLost: !!run?.lifeLost, hasLives, otherActive,
    onStart: handleBeginChallenge, onResume: handleResumeChallenge, onRefill: () => setShowLives(true),
    onHelp: hasVisualHelp ? handleOpenVisualHelp : undefined };

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
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { flex: 1 }]}>{level.kind === "practice" ? lesson.title[locale] : level.title[locale]}</Text>
          <PuzzleLives lives={lives} onPress={() => { recordInteraction(); setShowLives(true); }} />
        </View>

        <PuzzleProgress steps={progressSteps} total={position.total}
          label={t(level.kind === "boss" ? "learning.stageOf" : "play.puzzleOf", { number: position.current, total: position.total })} />
        {timed && challengePlayable && !answered && run ? <ChallengeClock milliseconds={run.deadlineAt - now} /> : null}

        <ScrollView
          scrollEnabled={!isDraggingTile}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!challengePlayable ? <TimedChallengeIntro {...challengeIntroProps} /> : <>
          {level.kind !== "practice" && <View style={[styles.mission, level.kind === "boss" ? styles.bossMission : styles.challengeMission]}>
            <Text style={styles.missionTitle}>{t(`learning.${level.kind}`)}</Text>
            {level.story?.backstory && sessionIndex === 0 ? <Text style={styles.missionDescription}>{level.story.backstory[locale]}</Text> : null}
            {level.story ? sessionIndex === 0 ? <Text style={styles.missionDescription}>{level.story.intro[locale]}</Text> : null
              : <Text style={styles.missionDescription}>{level.description[locale]}</Text>}
            {level.kind === "boss" && level.story ? <>
              <View style={styles.missionScene}><BossStoryScene story={level.story} locale={locale} completed={getBossSceneProgress(sessionIndex)} active={!answered} /></View>
              <Text style={styles.missionTitle}>{t("learning.stageOf", { number: sessionIndex + 1, total: puzzles.length })}{" · "}{level.story.stages[sessionIndex].title[locale]}</Text>
              <Text style={styles.missionDescription}>{level.story.stages[sessionIndex].before[locale]}</Text>
            </> : null}
            {level.kind === "boss" && <>
              {!level.story ? <Text style={styles.missionTitle}>{t("learning.stageOf", { number: sessionIndex + 1, total: puzzles.length })}</Text> : null}
              <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: getBossSceneProgress(sessionIndex, answered && isCorrect) }}
                accessibilityLabel={t("learning.boss")} style={styles.stageRow}>{puzzles.map((stage, index) => {
                const done = index < sessionIndex || index === sessionIndex && answered && isCorrect;
                return <View key={stage.id} style={[styles.stageMarker, done && styles.stageMarkerDone]} />;
              })}</View>
              <Text style={styles.missionSaved}>{t("learning.stagesSaved")}</Text>
            </>}
          </View>}
          <PuzzleCard
            puzzle={puzzle}
            puzzleNumber={puzzleNumber}
            puzzleTotal={position.total}
            coinReward={coinReward}
            levelKind={level.kind}
          />
          {!answered && hasVisualHelp ? (
            <Pressable
              style={styles.visualHelpBtn}
              onPress={handleOpenVisualHelp}
              accessibilityRole="button"
              accessibilityLabel={t("visualHelp.a11yOpen")}
            >
              <Text style={styles.visualHelpBtnText}>
                {t("visualHelp.compactButton")}
              </Text>
              {!visualHelpUnlocked ? (
                <Text style={styles.visualHelpBtnHint}>
                  {t("visualHelp.unlockPrice", { cost: visualHelpCost })}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.taskArea}>
            {puzzle.type !== "order_numbers" && puzzle.type !== "multiple_choice" && !(progress.completedPuzzleIds ?? []).some(
              (id) =>
                puzzles.find((item) => item.id === id)?.type === puzzle.type,
            ) && (
              <Text style={styles.mechanicIntro}>
                {t(difficulty === "hard" && puzzle.type === "target_build" ? "play.mechanicIntro.target_buildHard" : `play.mechanicIntro.${getPuzzleType(puzzle)}`)}
              </Text>
            )}
            <PuzzleTaskView
              puzzle={puzzle}
              hasLives={hasLives && challengePlayable}
              onIncorrectAttempt={handleInlineMistake}
              onChallengeAnswerChange={setChallengeAnswer}
              onDragStateChange={setIsDraggingTile}
              selectedIndex={pendingChoice}
              selectedOperators={selectedOperators}
              fractionPieces={fractionPieces}
              fractionSelectedSlices={fractionSelectedSlices}
              numberLineValue={pendingNumberLine}
              pairIndices={pairIndices}
              foundPairs={foundPairs}
              onFoundPairsChange={setFoundPairs}
              numberOrder={numberOrder}
              fractionMatchMatchedIds={fractionMatchMatchedIds}
              fractionMatchSelectedId={fractionMatchSelectedId}
              fractionMatchWrongIds={fractionMatchWrongIds}
              answered={answered}
              isCorrect={isCorrect}
              onSelectChoice={setPendingChoice}
              onSelectOperator={handleSelectOperator}
              onChangeFractionPieces={handleChangeFractionPieces}
              onToggleFractionSlice={handleToggleFractionSlice}
              onSelectNumberLineValue={setPendingNumberLine}
              onTogglePairIndex={handleTogglePairIndex}
              onMoveOrder={handleMoveOrder}
              onSwapOrder={(from, to) => {
                if (answered) return;
                setNumberOrder(current => current.map((value, index) => index === from ? current[to] : index === to ? current[from] : value));
              }}
              onTapFractionMatchCard={handleTapFractionMatchCard}
            />

          </View>
          </>}
        </ScrollView>

        {challengePlayable ? <View style={styles.answerDock}>
          {!answered && lives.current === 0 ? <View style={styles.emptyLives} accessibilityLiveRegion="polite">
            <Text style={styles.attemptTitle}>{t("lives.outOfLives")}</Text>
            <Text style={styles.attemptHint}>{t("lives.checkPaused")}</Text>
            {nextLife !== null ? <Text style={styles.lifePolicy}>{t("lives.nextLifeIn", { time: formatRegenCountdown(nextLife) })}</Text> : null}
            <Pressable onPress={() => setShowLives(true)} accessibilityRole="button" style={styles.lifeAction}>
              <Text style={styles.lifeActionText}>{t("lives.openRefill")}</Text>
            </Pressable>
          </View> : null}
          {!answered && lives.current > 0 && lastAttempt && draftKey === lastAttempt.key ? (
            <View style={styles.attemptFeedback} accessibilityLiveRegion="polite" accessible>
              <PuzzleCatPortrait key={`${lastAttempt.key}-${retryCount}`} petType={pet.type} catSkinId={pet.catSkinId}
                mood="incorrect" reaction={companionMessage.reaction} size={84} />
              <View style={styles.attemptCopy}>
                <Text style={styles.attemptTitle}>{t("play.adjustAnswer")}</Text>
                <Text style={styles.attemptHint}>{lastAttempt.hint}</Text>
              </View>
            </View>
          ) : null}
          {!answered && (retryCount >= 2 || lives.current === 0) && hasVisualHelp ? <Pressable onPress={handleOpenVisualHelp} accessibilityRole="button" style={styles.lifeAction}>
            <Text style={styles.lifeActionText}>{t("lives.workedExample")}</Text>
          </Pressable> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("play.checkAnswer")}
            accessibilityState={{ disabled: !canCheck }}
            disabled={!canCheck}
            onPress={handleCheckAnswer}
            style={({ pressed }) => [styles.checkAnswer, !canCheck && styles.checkAnswerDisabled, pressed && canCheck && styles.checkAnswerPressed]}
          >
            <Text style={[styles.checkAnswerText, !canCheck && { color: GameColors.textMuted }]}>{t("play.checkAnswer")}</Text>
          </Pressable>
        </View> : <View style={styles.answerDock}><TimedChallengeActions {...challengeIntroProps} /></View>}

        {answered ? (
          <ResultOverlay
            visible
            correct={isCorrect}
            bossStory={level.kind === "boss" && level.story ? { story: level.story, locale, completed: getBossSceneProgress(sessionIndex, isCorrect) } : undefined}
            petType={pet.type}
            catSkinId={pet.catSkinId}
            petMood={resultMood}
            catReaction={companionMessage.reaction}
            petName={pet.name}
            encouragement={isCorrect && level.story
              ? sessionIndex === 2 ? level.story.outcome[locale] : level.story.stages[sessionIndex].after[locale]
              : t(`puzzleCompanion.${companionMessage.key}`, { count: companionMessage.count })}
            message={
              isCorrect
                ? level.kind === "boss" && sessionIndex === puzzles.length - 1
                  ? t("learning.bossComplete")
                  : level.kind === "challenge" ? t(puzzle.type === "find_all_pairs" ? "learning.collectionComplete" : "learning.challengeComplete")
                  : isReplay ? t("play.crackedAgain")
                  : lessonFinished ? t("learning.lessonComplete")
                  : practiceFinished ? t("learning.practiceComplete")
                  : t("play.greatJob")
                : t("play.goodTry")
            }
            detail={puzzle.explanation}
            summary={isCorrect && !isReplay && level.kind === "boss" && sessionIndex === puzzles.length - 1 ? t("achievements.unlocked") : lessonFinished ? t("learning.lessonCompleteDetail")
              : practiceFinished && !isReplay ? t("learning.practiceCompleteDetail", { total: position.total }) : undefined}
            coinsEarned={coinsEarned}
            coinType={isReplay ? "sparkle" : "regular"}
            continueLabel={isCorrect
              ? nextSpecialLevel ? t(`learning.start_${nextSpecialLevel.kind}`)
                : level.kind === "boss" && sessionIndex + 1 < puzzles.length ? t("learning.nextStage")
                : level.kind !== "practice" || isReplay || !getNextPracticeLevel(lesson, level) ? t("learning.backToLesson") : t("play.nextPuzzle")
              : t("play.tryAgain")}
            onContinue={handleContinue}
            onGoHome={nextSpecialLevel ? exitToPath : isCorrect && !isReplay ? level.kind === "boss" && sessionIndex === puzzles.length - 1
              ? () => router.replace({ pathname: "/achievements", params: { boss: level.id } }) : handleGoHome : undefined}
            secondaryLabel={nextSpecialLevel ? t("learning.backToLesson") : level.kind === "boss" && sessionIndex === puzzles.length - 1 ? t("achievements.view") : undefined}
            onBuyLife={undefined}
            coins={wallet.coins}
          />
        ) : null}

        {showLives ? <BuyLifeSheet visible lives={lives} coins={wallet.coins} onBuyLife={buyLife} onClose={() => setShowLives(false)} /> : null}
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
  missionScene: { width: "100%", maxWidth: moderateScale(260), alignSelf: "center" },
  missionSaved: { color: GameColors.textMuted, fontSize: moderateScale(12), lineHeight: moderateScale(18) },
  stageRow: { flexDirection: "row", gap: moderateScale(8) },
  stageMarker: { flex: 1, height: moderateScale(6), backgroundColor: GameColors.card, borderRadius: moderateScale(3) },
  stageMarkerDone: { backgroundColor: GameColors.success },
  mechanicIntro: {
    color: GameColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  checkAnswer: {
    minHeight: moderateScale(56),
    borderRadius: 16,
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  answerDock: { paddingTop: moderateScale(10), gap: moderateScale(8), backgroundColor: GameColors.background },
  attemptFeedback: { flexDirection: "row", alignItems: "center", gap: moderateScale(8), paddingHorizontal: moderateScale(4) },
  attemptCopy: { flex: 1, gap: moderateScale(3) },
  attemptTitle: { fontSize: moderateScale(15), fontWeight: "800", color: "#875100" },
  attemptHint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: GameColors.text },
  titleRow: { flexDirection: "row", alignItems: "center", gap: moderateScale(12) },
  emptyLives: { gap: moderateScale(3) },
  lifePolicy: { fontSize: moderateScale(12), lineHeight: moderateScale(18), color: GameColors.textMuted },
  lifeAction: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  lifeActionText: { fontSize: moderateScale(14), fontWeight: "700", color: GameColors.secondaryDark },
  checkAnswerDisabled: { backgroundColor: "#E6DED5" },
  checkAnswerPressed: { opacity: 0.85 },
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
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
    marginBottom: moderateScale(8),
  },
  scroll: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  scrollContent: {
    flexGrow: 0,
    gap: moderateScale(12),
    paddingBottom: moderateScale(16),
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
    minHeight: 44,
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    alignItems: "center",
    alignSelf: "flex-end",
    gap: moderateScale(2),
  },
  visualHelpBtnText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#6B4FCF",
  },
  visualHelpBtnHint: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.coinText,
  },
});
