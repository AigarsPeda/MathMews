import { getCatPlanReward } from "@/constants/cat-plan-rewards";
import type { BridgeState } from "@/utils/bridge-models";
import type { DecimalPlaceState } from "@/utils/decimal-models";
import type { FractionStripState } from "@/utils/fraction-models";
import type { PlaceValueState } from "@/utils/place-value";
import { BuyLifeSheet } from "@/components/economy/BuyLifeSheet";
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { PuzzleHeaderGlow } from "@/components/puzzle/PuzzleGradient";
import { useFonts } from "expo-font";
import { PuzzleLives } from "@/components/puzzle/PuzzleLives";
import { PuzzleProgress } from "@/components/puzzle/PuzzleProgress";
import { PuzzleTaskView } from "@/components/puzzle/PuzzleTaskView";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { ChallengeClock, TimedChallengeActions, TimedChallengeIntro } from "@/components/puzzle/TimedChallenge";
import { VisualHelpSheet } from "@/components/puzzle/VisualHelpSheet";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { getLevelPuzzles, type LearningSession } from "@/constants/curriculum";
import { getChallengePathLocation, getNextPathLevel, getNextPathStep, getPathCompletedIds, getPathProgress, resolvePathSession } from "@/constants/puzzle-path";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { PuzzleFontAssets } from "@/constants/puzzle-fonts";
import { getVisualHelpCost, MAX_LIVES } from "@/constants/game";
import { isPuzzleDifficulty } from "@/constants/puzzles";
import { hasVisualExplanation } from "@/constants/visual-explanations";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { useWorldClockNow } from "@/hooks/use-world-clock-now";
import type { PetAnimationState } from "@/types/game";
import type { MathOperator, Puzzle, PuzzleDifficulty } from "@/types/puzzle";
import type { ChallengeAnswer } from "@/utils/challenge-puzzles";
import {
  buildFractionMatchCards,
  isFractionMatchPair,
} from "@/utils/fraction-match";
import { resizeFractionSelection, toggleFractionSlice } from "@/utils/fraction-pie";
import { applyLifeRegen, formatRegenCountdown, msUntilNextLife } from "@/utils/lives";
import { getPuzzleAttemptHint, getPuzzleDraftAnswer } from "@/utils/puzzle-attempt";
import { getPuzzleCompanionMessage } from "@/utils/puzzle-companion";
import { moveOrderTile } from "@/utils/puzzle-drag";
import { shufflePuzzleChoices } from "@/utils/puzzle-practice";
import {
  asFractionBuildPuzzle,
  asFractionMatchPuzzle,
  asOrderNumbersPuzzle,
  checkPuzzleAnswer,
  getOperatorSlotCount,
  getPuzzleType,
} from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { getTimedRunReward, isChallengeOpen } from "@/utils/timed-challenge";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const PUZZLE_CONTENT_ENTER = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

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
  const params = useLocalSearchParams<{ difficulty?: string; lesson?: string; level?: string; phase?: string; replay?: string }>();
  const { locale } = useLocale();
  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  const difficulty: PuzzleDifficulty = isPuzzleDifficulty(params.difficulty ?? "") ? params.difficulty as PuzzleDifficulty : "easy";
  return <LearningPlayGate key={`${locale}-${difficulty}-${params.replay}`}
    difficulty={difficulty} lessonId={params.lesson} levelId={params.level} phaseParam={params.phase} replaySession={params.replay === "1"} />;
}

function LearningPlayGate({ difficulty, lessonId, levelId, phaseParam, replaySession }: {
  difficulty: PuzzleDifficulty; lessonId?: string; levelId?: string; phaseParam?: string; replaySession?: boolean;
}) {
  const { progress, hasCompletedOnboarding } = useGame();
  // Freeze entry context. Recording a successful stage must not advance the task
  // until the child dismisses its result, nor turn its first reward into a replay.
  const routeKey = `${lessonId}-${levelId}-${phaseParam}`;
  const [entry, setEntry] = useState(() => ({ routeKey,
    session: resolvePathSession(difficulty, lessonId, levelId, phaseParam, progress) }));
  if (entry.routeKey !== routeKey) {
    setEntry({ routeKey, session: resolvePathSession(difficulty, lessonId, levelId, phaseParam, progress) });
  }
  const { session } = entry;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if (!session) return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  return <PlaySession session={session} replaySession={replaySession} />;
}

export function PlaySession({ session, replaySession = false }: { session: LearningSession; replaySession?: boolean }) {
  const [fontsLoaded, fontError] = useFonts(PuzzleFontAssets);
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lesson, level, phase: sessionIndex } = session;
  const difficulty = lesson.difficulty;
  const { pet, requestRoomDecoration, recordLearningHelp, answerPuzzle, buyLife, wallet, isReady, progress, hasCompletedOnboarding, recordInteraction, purchaseVisualHelp, beginChallenge, expireChallenge } = useGame();
  const run = progress.challengeAttempt;
  const [challengeMode, setChallengeMode] = useState<"timed" | "untimed">("untimed");
  const atChallenge = level.kind === "challenge" && !!level.timeLimitSeconds;
  const now = useWorldClockNow(1000, progress.lives.current < MAX_LIVES || run?.status === "active");
  const lives = applyLifeRegen(progress.lives, now);
  const nextLife = msUntilNextLife(lives, now);
  const hasLives = lives.current > 0;
  const puzzles = getLevelPuzzles(locale, lesson, level);
  const [entryRewardIds, setEntryRewardIds] = useState(progress.catPlanRewardsClaimed ?? []);
  const [entryCompleted, setEntryCompleted] = useState(getPathCompletedIds(progress));
  const [initialAttemptId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const attemptId = useRef(initialAttemptId);
  const isReplay = entryCompleted.includes(puzzles[sessionIndex].id);
  const [puzzle, setPuzzle] = useState(() => shufflePuzzleChoices(puzzles[sessionIndex],
    `${level.id}-${sessionIndex}-${progress.puzzleStreak}`));
  const position = { current: lesson.levels.findIndex(item => item.id === level.id) + 1, total: lesson.levels.length };
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
  const [editingRetry, setEditingRetry] = useState(false);
  const taskScroll = useRef<ScrollView>(null);
  const submittedAnswer = useRef<string | null>(null);
  const matchingAttempt = useRef<string | null>(null);
  const [bridge, setBridge] = useState<BridgeState | null>(null);
  const [geometry, setGeometry] = useState<number | null>(null);
  const [decimalGrid, setDecimalGrid] = useState<number | null>(null);
  const [decimalPlace, setDecimalPlace] = useState<DecimalPlaceState | null>(null);
  const [fractionStrip, setFractionStrip] = useState<FractionStripState | null>(null);
  const [placeValue, setPlaceValue] = useState<PlaceValueState | null>(null);
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
  const sessionKey = `${lesson.id}-${level.id}-${sessionIndex}`;
  const [activeSessionKey, setActiveSessionKey] = useState(sessionKey);
  if (activeSessionKey !== sessionKey) {
    // Reset the attempt before painting the new puzzle. Keep the screen and header mounted.
    const nextPuzzle = shufflePuzzleChoices(puzzles[sessionIndex], `${level.id}-${sessionIndex}-${progress.puzzleStreak}`);
    setActiveSessionKey(sessionKey);
    setPuzzle(nextPuzzle);
    setEntryCompleted(getPathCompletedIds(progress));
    setEntryRewardIds(progress.catPlanRewardsClaimed ?? []);
    setChallengeMode("untimed");
    setPendingChoice(null); setPendingNumberLine(null); setSelectedOperators(createEmptyOperators(nextPuzzle));
    setBridge(null); setGeometry(null); setDecimalGrid(null); setDecimalPlace(null); setFractionStrip(null); setPlaceValue(null);
    setChallengeAnswer(null); setFoundPairs([]); setPairIndices([]); setFractionSelectedSlices([]);
    setNumberOrder(createInitialOrder(nextPuzzle)); setFractionMatchMatchedIds([]); setFractionMatchSelectedId(null); setFractionMatchWrongIds([]);
    setLastAttempt(null); setEditingRetry(false); setRetryCount(0); setIsDraggingTile(false); setAnswered(false); setIsCorrect(false);
    setCoinsEarned(0); setShowVisualHelp(false); setShowLives(false);
  }
  useEffect(() => {
    submittedAnswer.current = null; matchingAttempt.current = null;
    attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [sessionKey]);
  const inTimedRun = run?.mode !== "untimed" && !!run?.puzzleIds?.includes(puzzle.id);
  const challengePlayable = !(atChallenge || inTimedRun && run?.status !== "completed") || answered || isChallengeOpen(run, puzzle.id, now);
  const otherActive = run?.status === "active" && !inTimedRun && run.puzzleId !== puzzle.id && (run.mode === "untimed" || now < run.deadlineAt);
  const expired = (inTimedRun || run?.puzzleId === puzzle.id) && (run?.status === "expired" || run?.status === "active" && run.mode !== "untimed" && now >= run.deadlineAt);

  useEffect(() => {
    if (!answered && run?.status === "expired" && inTimedRun && level.id !== run.levelId) {
      router.setParams({ level: run.levelId, phase: undefined });
    }
  }, [answered, run, inTimedRun, level.id, router]);

  useEffect(() => {
    if (run?.status === "active" && run.mode !== "untimed" && now >= run.deadlineAt) expireChallenge(run.id);
  }, [run, now, expireChallenge]);

  const handleBeginChallenge = useCallback(() => {
    if (!beginChallenge(level.id, challengeMode)) return;
    recordInteraction();
    setPendingChoice(null); setPendingNumberLine(null); setSelectedOperators(createEmptyOperators(puzzle));
    setBridge(null); setGeometry(null); setDecimalGrid(null); setDecimalPlace(null); setFractionStrip(null); setPlaceValue(null);
    setChallengeAnswer(null); setFoundPairs([]); setPairIndices([]); setFractionSelectedSlices([]);
    setNumberOrder(createInitialOrder(puzzle)); setFractionMatchMatchedIds([]); setFractionMatchSelectedId(null); setFractionMatchWrongIds([]);
    setLastAttempt(null); setEditingRetry(false); setRetryCount(0); setIsDraggingTile(false); setAnswered(false); setIsCorrect(false);
    submittedAnswer.current = null; matchingAttempt.current = null;
    attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [beginChallenge, level.id, puzzle, recordInteraction, challengeMode]);
  const handleResumeChallenge = useCallback(() => {
    const location = run && getChallengePathLocation(run);
    if (location) router.replace({ pathname: "/play", params: { difficulty: location.lesson.difficulty, lesson: location.lesson.id, level: location.level.id } });
  }, [run, router]);

  const visualHelpCost = getVisualHelpCost(difficulty);
  const visualHelpUnlocked = true;
  const hasVisualHelp = hasVisualExplanation(puzzle);

  const draftAnswer = useMemo(() => getPuzzleDraftAnswer(puzzle, {
    bridge, geometry, decimalGrid, decimalPlace, fractionStrip, placeValue, choice: pendingChoice, operators: selectedOperators, shaded: fractionPieces,
    numberLine: pendingNumberLine, pairIndices, order: numberOrder,
    matchedCount: fractionMatchMatchedIds.length / 2, pairs: foundPairs, challenge: challengeAnswer,
  }), [puzzle, bridge, geometry, decimalGrid, decimalPlace, fractionStrip, placeValue, pendingChoice, selectedOperators, fractionPieces, pendingNumberLine, pairIndices, numberOrder, fractionMatchMatchedIds.length, foundPairs, challengeAnswer]);
  const draftKey = JSON.stringify(draftAnswer);
  const offerRetry = !answered && hasLives && !!lastAttempt && draftKey === lastAttempt.key && !editingRetry;
  const canCheck = hasLives && challengePlayable && !answered && draftAnswer !== null && draftKey !== lastAttempt?.key;
  const progressSteps = lesson.levels.map((item, index) => replaySession ? index < position.current - 1 || answered && index === position.current - 1
    : item.puzzleIds.every(id => entryCompleted.includes(id) || answered && id === puzzle.id));
  const resultProgress = { ...progress, completedPuzzleIds: [...entryCompleted, ...(answered ? [puzzle.id] : [])] };
  const lessonFinished = answered && position.current === position.total && getPathProgress(lesson, resultProgress).complete;
  const earnedDecoration = lessonFinished && isCorrect && !expired && !entryRewardIds.includes(lesson.id) && progress.catPlanRewardsClaimed?.includes(lesson.id) ? getCatPlanReward(lesson.id) : undefined;
  const resultMood: PetAnimationState = isCorrect && !expired ? "correct" : "incorrect";
  const nextPuzzleRoute = useMemo(() => {
    if (!isCorrect) return undefined;
    const next = getNextPathStep(lesson, level, { ...progress, completedPuzzleIds: [...entryCompleted, puzzle.id] }, replaySession);
    return next ? { pathname: "/play" as const, params: { difficulty, lesson: next.lesson.id, level: next.level.id, ...(replaySession && { replay: "1" }) } } : undefined;
  }, [difficulty, isCorrect, lesson, level, progress, entryCompleted, puzzle.id, replaySession]);
  const nextLevelRoute = useMemo(() => {
    if (!isCorrect || !lessonFinished) return undefined;
    const next = getNextPathLevel(lesson, { ...progress, completedPuzzleIds: [...entryCompleted, puzzle.id] });
    return next ? { pathname: "/play" as const, params: { difficulty, lesson: next.lesson.id, level: next.level.id,
      replay: next.replay ? "1" : undefined } } : undefined;
  }, [difficulty, isCorrect, lessonFinished, lesson, progress, entryCompleted, puzzle.id]);

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
    router.dismissTo({ pathname: "/puzzles", params: { difficulty, topic: lesson.topicId } });
  }, [difficulty, lesson.topicId, router]);

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
      setEditingRetry(false);
      const hint = getPuzzleAttemptHint(puzzle, draftAnswer, retryCount + 1);
      setLastAttempt({ key: draftKey, hint: hint ? [t(`play.attemptHints.${hint.key}`), hint.detailKey ? t(`play.attemptHints.${hint.detailKey}`) : null].filter(Boolean).join(" ") : puzzle.hint });
      setRetryCount(count => count + 1);
      attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [canCheck, draftAnswer, draftKey, puzzle, answerPuzzle, t, retryCount]);

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
    if (expired && run) {
      setAnswered(false);
      router.setParams({ level: run.levelId, phase: undefined });
      return;
    }
    if (isCorrect) {
      // Update this route in place after the result sheet has finished closing.
      const next = nextPuzzleRoute ?? nextLevelRoute;
      if (next) router.setParams({ ...next.params, phase: undefined });
      else exitToPath();
    }
  }, [nextPuzzleRoute, nextLevelRoute, exitToPath, isCorrect, router, expired, run]);

  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;

  const companionMessage = getPuzzleCompanionMessage({
    correct: isCorrect && !expired,
    kind: level.kind,
    finalStage: sessionIndex === puzzles.length - 1,
    practiceFinished: lessonFinished,
    replay: isReplay,
    retries: retryCount,
    completedCount: new Set(entryCompleted).size + (isCorrect && !isReplay ? 1 : 0),
    puzzleId: puzzle.id,
  });
  const challengeIntroProps = { level, title: lesson.topicId === 'cat-plans' ? lesson.title[locale] : undefined,
    description: lesson.topicId === 'cat-plans' ? lesson.description[locale] : undefined,
    mode: challengeMode, onModeChange: setChallengeMode, expired: !!expired, lifeLost: !!run?.lifeLost, hasLives, otherActive,
    onStart: handleBeginChallenge, onResume: handleResumeChallenge, onRefill: () => setShowLives(true) };

  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <PuzzleHeaderGlow color={GameColors.playGlow} />
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
          <View style={styles.headerProgress}>
            <PuzzleProgress steps={progressSteps} total={position.total} animated={false}
              label={t("play.puzzleOf", { number: position.current, total: position.total })} />
          </View>
          <PuzzleLives lives={lives} onPress={() => { recordInteraction(); setShowLives(true); }} />
        </View>

        {run?.status === "active" && run.mode !== "untimed" && (atChallenge || inTimedRun) ? <ChallengeClock milliseconds={run.deadlineAt - now} /> : null}

        <Animated.ScrollView
          ref={taskScroll}
          key={puzzle.id}
          entering={PUZZLE_CONTENT_ENTER}
          scrollEnabled={!isDraggingTile}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!challengePlayable ? <TimedChallengeIntro {...challengeIntroProps} /> : <>
          <PuzzleCard puzzle={puzzle} />

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
              bridge={bridge}
              onBridgeChange={setBridge}
              geometry={geometry}
              onGeometryChange={setGeometry}
              decimalGrid={decimalGrid}
              onDecimalGridChange={setDecimalGrid}
              decimalPlace={decimalPlace}
              onDecimalPlaceChange={setDecimalPlace}
              fractionStrip={fractionStrip}
              onFractionStripChange={setFractionStrip}
              placeValue={placeValue}
              onPlaceValueChange={setPlaceValue}
              onChallengeAnswerChange={setChallengeAnswer}
              onDragStateChange={setIsDraggingTile}
              selectedIndex={pendingChoice}
              incorrectAttempt={!answered && lastAttempt !== null && draftKey === lastAttempt.key}
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
          </>}
        </Animated.ScrollView>

        {challengePlayable ? <View style={styles.answerDock}>
          {!answered && lives.current === 0 ? <View style={styles.emptyLives} accessibilityLiveRegion="polite">
            <Text style={styles.attemptTitle}>{t("lives.outOfLives")}</Text>
            <Text style={styles.attemptHint}>{t("lives.checkPaused")}</Text>
            {nextLife !== null ? <Text style={styles.lifePolicy}>{t("lives.nextLifeIn", { time: formatRegenCountdown(nextLife) })}</Text> : null}
          </View> : null}
          {!answered && lives.current > 0 && lastAttempt && draftKey === lastAttempt.key ? (
            <View style={styles.attemptFeedback} accessibilityLiveRegion="polite" accessible>
              <View style={styles.attemptCopy}>
                <Text style={styles.attemptTitle}>{t("play.adjustAnswer")}</Text>
                <Text style={styles.attemptHint}>{lastAttempt.hint}</Text>
              </View>
            </View>
          ) : null}
          {!answered && (retryCount >= 2 || lives.current === 0) && hasVisualHelp ? <Pressable onPress={handleOpenVisualHelp} accessibilityRole="button" style={styles.lifeAction}>
            <Text style={styles.lifeActionText}>{t("lives.workedExample")}</Text>
          </Pressable> : null}
          <PuzzleButton
            label={t(!hasLives ? "lives.refillToRetry" : offerRetry ? "play.tryAgain" : "play.checkAnswer")}
            accessibilityLabel={t(!hasLives ? "lives.refillToRetry" : offerRetry ? "play.tryAgain" : "play.checkAnswer")}
            accessibilityState={{ disabled: hasLives && !offerRetry && !canCheck }}
            disabled={hasLives && !offerRetry && !canCheck}
            onPress={() => {
              if (!hasLives) { setShowLives(true); return; }
              if (offerRetry) {
                setEditingRetry(true);
                taskScroll.current?.scrollTo({ y: 0, animated: false });
                return;
              }
              handleCheckAnswer();
            }}
          />
          {!answered && (!hasLives || retryCount > 0) ? <Pressable onPress={exitToPath} accessibilityRole="button" style={styles.lifeAction}>
            <Text style={styles.lifeActionText}>{t("play.backToPath")}</Text>
          </Pressable> : null}
        </View> : <View style={styles.answerDock}>
          <TimedChallengeActions {...challengeIntroProps} />
          <Pressable onPress={exitToPath} accessibilityRole="button" style={styles.lifeAction}>
            <Text style={styles.lifeActionText}>{t("play.backToPath")}</Text>
          </Pressable>
        </View>}

        {answered ? (
          <ResultOverlay
            visible
            decorationLessonId={earnedDecoration?.lessonId}
            correct={isCorrect && !expired}
            petType={pet.type}
            catSkinId={pet.catSkinId}
            petMood={resultMood}
            catReaction={companionMessage.reaction}
            petName={pet.name}
            encouragement={t(`puzzleCompanion.${companionMessage.key}`, { count: companionMessage.count })}
            message={t(expired ? "timedChallenge.expired" : inTimedRun && run?.status === "completed" ? "timedChallenge.completed" : isCorrect ? lessonFinished ? "puzzlePathDesign.levelComplete" : isReplay ? "play.crackedAgain" : "play.greatJob" : "play.goodTry")}
            detail={expired ? t(run?.lifeLost ? "timedChallenge.lifeUsed" : "timedChallenge.attemptEnded") : puzzle.explanation}
            summary={isCorrect && !expired && lessonFinished ? lesson.completion?.[locale] : undefined}
            coinsEarned={expired ? 0 : coinsEarned}
            pendingCoins={!expired && inTimedRun && run?.status === "active" ? getTimedRunReward(progress) : 0}
            coinType={isReplay ? "sparkle" : "regular"}
            continueLabel={t(expired ? "timedChallenge.retry" : isCorrect ? nextPuzzleRoute ? "play.nextPuzzle" : nextLevelRoute ? "puzzlePathDesign.nextLevel" : "puzzlePathDesign.viewPath" : "play.tryAgain")}
            onContinue={handleContinue}
            onGoHome={earnedDecoration ? () => {
              requestRoomDecoration({ kind: "decoration", id: earnedDecoration.decorationId });
              router.dismissTo("/");
            } : isCorrect && !expired && !nextPuzzleRoute && !nextLevelRoute ? undefined : exitToPath}
            secondaryLabel={t(earnedDecoration ? "catPlans.placeInHouse" : "play.backToPath")}
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
  mechanicIntro: {
    color: GameColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  answerDock: { paddingTop: moderateScale(16), paddingBottom: moderateScale(8), borderTopWidth: 1, borderTopColor: GameColors.cardBorder, gap: moderateScale(12), backgroundColor: GameColors.background },
  attemptFeedback: { flexDirection: "row", alignItems: "center", gap: moderateScale(8), padding: moderateScale(14), borderRadius: moderateScale(14), backgroundColor: GameColors.warningSurface },
  attemptCopy: { flex: 1, gap: moderateScale(3) },
  attemptTitle: { fontSize: moderateScale(15), fontWeight: "800", color: "#875100" },
  attemptHint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: GameColors.text },
  emptyLives: { gap: moderateScale(3) },
  lifePolicy: { fontSize: moderateScale(12), lineHeight: moderateScale(18), color: GameColors.textMuted },
  lifeAction: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  lifeActionText: { fontSize: moderateScale(14), fontWeight: "700", color: GameColors.secondaryDark },
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
    paddingHorizontal: moderateScale(22),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(4),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: moderateScale(8),
    gap: moderateScale(12),
  },
  headerProgress: { flex: 1 },
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
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
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
    backgroundColor: "transparent",
    borderRadius: moderateScale(16),
    minHeight: 44,
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    alignItems: "center",
    alignSelf: "center",
    gap: moderateScale(2),
  },
  visualHelpBtnText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.primary,
  },
  visualHelpBtnHint: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.coinText,
  },
});
