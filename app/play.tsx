import { ModelStage } from '@/components/puzzle/kit/ModelStage';
import { QuantityPracticeProvider } from '@/components/puzzle/counting/QuantityPractice';
import { ExchangeScrollContext } from '@/components/puzzle/place-value/ExchangeDetail';
import type { PlayProofAudit } from '@/components/dev/PlayProofAudit';
import { useReducedMotion } from 'react-native-reanimated';
import { CheckedPuzzleReveal } from '@/components/puzzle/CheckedPuzzleReveal';
import { checkedAnswerKey, effectivePuzzlePrompt, freezeCheckedAttempt, type CheckedAttempt } from '@/utils/checked-attempt';
import type { puzzleQADraft } from '@/utils/puzzle-qa-draft';
import { getCatPlanReward } from "@/constants/cat-plan-rewards";
import type { BridgeState } from "@/utils/bridge-models";
import type { ResponseValue } from '@/utils/puzzle-response';
import type { DecimalPlaceState } from "@/utils/decimal-models";
import type { FractionStripState } from "@/utils/fraction-models";
import type { PlaceValueState } from "@/utils/place-value";
import { BuyLifeSheet } from "@/components/economy/BuyLifeSheet";
import { isLimitStory, splitNumberSequence } from '@/components/puzzle/glyphs/StoryGivens';
import { WrittenAnswer } from "@/components/puzzle/PuzzleResponseTask";
import { hasStoryAnswerWell, hasStoryReveal, PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { ChoiceButton } from '@/components/puzzle/ChoiceButton';
import { submittedLabel } from '@/utils/submitted-response';
import { PlayProofCaptionContext, ProofViewportContext, type ProofViewport } from "@/components/puzzle/PlayProofCaption";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { PuzzleHeaderGlow } from "@/components/puzzle/PuzzleGradient";
import { useFonts } from "expo-font";
import { PuzzleLives } from "@/components/puzzle/PuzzleLives";
import { PuzzleProgress } from "@/components/puzzle/PuzzleProgress";
import { PuzzleContentTransition } from "@/components/puzzle/PuzzleContentTransition";
import { PuzzleTaskView } from "@/components/puzzle/PuzzleTaskView";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { ChallengeClock, TimedChallengeActions, TimedChallengeIntro } from "@/components/puzzle/TimedChallenge";
import { VisualHelpSheet } from "@/components/puzzle/VisualHelpSheet";
import { RevealPlayContext } from "@/components/puzzle/kit/RevealSurface";
import { ClockResponseHint } from '@/components/puzzle/ClockResponseHint';
import { DiagramIcon } from "@/components/puzzle/kit/DiagramIcon";
import { StoryHost } from "@/components/puzzle/kit/PracticeAffordances";
import { AppIcon } from "@/components/ui/AppIcon";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { getLevelPuzzles, type LearningSession } from "@/constants/curriculum";
import { getChallengePathLocation, getNextPathLevel, getNextPathStep, getPathCompletedIds, getPathEntry, getPathProgress, resolvePathSession } from "@/constants/puzzle-path";
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
import { resizeFractionSelection, toggleFractionSlice } from "@/utils/fraction-pie";
import { applyLifeRegen, formatRegenCountdown, msUntilNextLife } from "@/utils/lives";
import { getPuzzleAttemptHint, getPuzzleDraftAnswer } from "@/utils/puzzle-attempt";
import { getPuzzleCompanionMessage } from "@/utils/puzzle-companion";
import { moveOrderTile } from "@/utils/puzzle-drag";
import { shufflePuzzleChoices } from "@/utils/puzzle-practice";
import {
  asFractionBuildPuzzle,
  asOrderNumbersPuzzle,
  checkPuzzleAnswer,
  getOperatorSlotCount,
  fractionChoiceMechanic,
  hasClockStoryPrompt,
  getPuzzleType,
} from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { getTimedRunReward, isChallengeOpen } from "@/utils/timed-challenge";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
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
  haptics = true,
}: {
  haptics?: boolean;
  correct: boolean;
  puzzle: Puzzle;
  attemptId: string;
  answerPuzzle: ReturnType<typeof useGame>["answerPuzzle"];
  setCoinsEarned: (value: number) => void;
  setIsCorrect: (value: boolean) => void;
}) {
  const coins = answerPuzzle(puzzle, correct, attemptId);
  if (coins === null) return false;
  if (haptics) triggerHaptic(
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
  const resolveEntry = () => {
    const session = resolvePathSession(difficulty, lessonId, levelId, phaseParam, progress);
    return { routeKey, session, replay: replaySession || !!session && !!getPathEntry(session.lesson, progress)?.replay };
  };
  const [entry, setEntry] = useState(resolveEntry);
  if (entry.routeKey !== routeKey) {
    setEntry(resolveEntry());
  }
  const { session } = entry;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if (!session) return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  return <PlaySession session={session} replaySession={entry.replay} />;
}

// Only the dock subscribes to playback controls. Updating a beat does not re-render the editor.
// Keep the original native view (including its mounted Skia surfaces) in front of the
// incoming proof until the family acknowledges its first complete drawing.
const PracticeDrawing = memo(function PracticeDrawing({ children, viewport }: { children: ReactNode; frozen: boolean; viewport: ProofViewport | null }) {
  return <ProofViewportContext.Provider value={viewport}>{children}</ProofViewportContext.Provider>;
}, (_, incoming) => incoming.frozen);

function CheckedDrawingTransition({ children, checked, preparing, viewport }: {
  children: ReactNode; checked: boolean; preparing: boolean; viewport: ProofViewport | null;
}) {
  return <>
    {(!checked || preparing) && <View collapsable={false} pointerEvents={checked ? 'none' : 'auto'}
      accessibilityElementsHidden={checked} importantForAccessibility={checked ? 'no-hide-descendants' : 'auto'}
      style={checked ? styles.retainedDrawing : undefined}>
      <PracticeDrawing frozen={checked} viewport={viewport}>{children}</PracticeDrawing>
    </View>}
    {checked && children}
  </>;
}

function createControlHost() {
  let controls: ReactNode = null;
  const listeners = new Set<() => void>();
  const publish = (value: ReactNode) => {
    controls = value;
    for (const listener of listeners) listener();
  };
  return {
    publish,
    read: () => controls,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    Controls({ children }: { children: ReactNode }) {
      useLayoutEffect(() => { publish(children); return () => publish(null); }, [children]);
      return null;
    },
  };
}
function NoAnswerRow() { return null; }
const ignorePress = () => {};
const COLLAPSED_QUESTION_HEIGHT = 44;
function PlaybackDock({ host, nativeID, reserveControls = false }: { host: ReturnType<typeof createControlHost>; nativeID?: string; reserveControls?: boolean }) {
  const content = useSyncExternalStore(host.subscribe, host.read, host.read);
  if (reserveControls) return <View nativeID={nativeID} style={styles.playbackControls}>{content}</View>;
  return content && nativeID ? <View nativeID={nativeID}>{content}</View> : <>{content}</>;
}

export type PuzzleLayoutMeasurement = { puzzleId: string; viewportHeight: number; contentHeight: number };

export function PlaySession({ session, replaySession = false, onLayoutMeasured, preview, qaDraft, proofAudit }: {
  session: LearningSession; replaySession?: boolean;
  proofAudit?: PlayProofAudit;
  qaDraft?: (puzzle: Puzzle) => ReturnType<typeof puzzleQADraft>;
  preview?: { onExit: () => void; onRepeat: () => void; onNext: () => void };
  /** Native layout review only; observing does not change the screen or player state. */
  onLayoutMeasured?: (measurement: PuzzleLayoutMeasurement) => void;
}) {
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
  const fixture = useMemo(() => qaDraft?.(puzzle), [qaDraft, puzzle]);
  const [snapshot, setSnapshot] = useState<(CheckedAttempt & { submissionId: string; stage: { key: string; height: number } }) | null>(null);
  const [decimalCells, setDecimalCells] = useState<readonly number[]>(fixture?.arrangement.decimalCells ?? []);
  const [distribution, setDistribution] = useState<readonly number[]>(fixture?.arrangement.distribution ?? []);
  const position = { current: lesson.levels.findIndex(item => item.id === level.id) + 1, total: lesson.levels.length };
  const [foundPairs, setFoundPairs] = useState<[number, number][]>(fixture?.draft.pairs ?? []);
  const [isDraggingTile, setIsDraggingTile] = useState(false);

  const [pendingChoice, setPendingChoice] = useState<number | null>(fixture?.draft.choice ?? null);
  const [responseValue, setResponseValue] = useState<ResponseValue>(fixture?.draft.response ?? null);
  const [pendingNumberLine, setPendingNumberLine] = useState<number | null>(fixture?.draft.numberLine ?? null);
  const [selectedOperators, setSelectedOperators] = useState<
    (MathOperator | null)[]
  >(() => fixture?.draft.operators ?? createEmptyOperators(puzzle));
  const [answered, setAnswered] = useState(false);
  const [, setSolutionShown] = useState(false);
  const [openResult, setOpenResult] = useState(false);
  const markSolutionShown = useCallback(() => { setSolutionShown(true); proofAudit?.record({ phase: 'completed' }); }, [proofAudit]);
  // "Watch again" restarts the reveal; the result sheet waits for it to settle again.
  const liveFeedback = !preview && !onLayoutMeasured;
  const [controlHost] = useState(createControlHost);
  const [answerHost] = useState(createControlHost);
  const [captionHost] = useState(createControlHost);
  const { fontScale } = useWindowDimensions();
  const [dockHeight, setDockHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [modelSlot, setModelSlot] = useState({ width: 0, top: 0 });
  const [paintedAttempt, setPaintedAttempt] = useState<string>();
  const [promptBottom, setPromptBottom] = useState(0);
  const [largePromptBottom, setLargePromptBottom] = useState(0);
  const [fullPromptHeight, setFullPromptHeight] = useState(0);
  const [taskHeight, setTaskHeight] = useState(0);
  const manuallyScrolledAttempt = useRef<string | undefined>(undefined);
  const [fractionStrip, setFractionStrip] = useState<FractionStripState | null>(fixture?.draft.fractionStrip ?? null);
  const [fractionSelectedSlices, setFractionSelectedSlices] = useState<number[]>(() => [...(fixture?.arrangement.selectedSlices ?? [])]);
  const [challengeAnswer, setChallengeAnswer] = useState<ChallengeAnswer | null>(fixture?.draft.challenge ?? null);
  const showingSolution = answered && !openResult;
  // A worked solution stays on screen, with Watch again available, until the child taps
  // "See result" themselves (council decision): no automatic deadline can interrupt a replay.
  const [lastAttempt, setLastAttempt] = useState<{ key: string; hint: string } | null>(null);
  const [editingRetry, setEditingRetry] = useState(false);
  const taskScroll = useRef<ScrollView>(null);
  useLayoutEffect(() => { taskScroll.current?.scrollTo({ y: 0, animated: false }); }, [puzzle.id]);
  const scrollContent = useRef<View>(null!);
  const reducedMotion = useReducedMotion();
  const scrollToExchange = useCallback((anchor: View) => {
    const scroll = taskScroll.current;
    const content = scrollContent.current;
    if (content) anchor.measureLayout(content, (_x, y) => scroll?.scrollTo({ y: Math.max(0, y - 8), animated: !reducedMotion }));
  }, [reducedMotion]);
  const everydayModel = 'everyday' in puzzle ? puzzle.everyday?.model : undefined;
  const capacity = everydayModel?.kind === 'capacity';
  const money = everydayModel?.kind === 'money';
  const shopping = money || puzzle.type === 'budget_plan';
  const hasEverydayAttempt = capacity || money || everydayModel?.kind === 'clock' || everydayModel?.kind === 'bars'
    || everydayModel?.kind === 'solid' || (everydayModel?.kind === 'shapes' && everydayModel.task === 'symmetry');
  const headingRef = useRef<View>(null);
  const headingPosition = useRef({ top: 0, bottom: 0, scroll: 0 });
  const [headingOffscreen, setHeadingOffscreen] = useState(false);
  const layoutSize = useRef({ viewportHeight: 0, contentHeight: 0 });
  const updateQuestionLink = () => {
    const heading = headingPosition.current;
    const { viewportHeight, contentHeight } = layoutSize.current;
    setHeadingOffscreen(heading.bottom > 0 && heading.scroll >= heading.bottom && contentHeight - heading.bottom > viewportHeight);
  };
  const readQuestionAgain = () => {
    taskScroll.current?.scrollTo({ y: headingPosition.current.top, animated: false });
    if (headingRef.current) AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus');
  };
  const reportLayout = (size: Partial<typeof layoutSize.current>) => {
    Object.assign(layoutSize.current, size);
    if (capacity) updateQuestionLink();
    if (layoutSize.current.viewportHeight && layoutSize.current.contentHeight) {
      onLayoutMeasured?.({ puzzleId: puzzle.id, ...layoutSize.current });
    }
  };
  const submittedAnswer = useRef<string | null>(null);
  const [bridge, setBridge] = useState<BridgeState | null>(fixture?.draft.bridge ?? null);
  const [geometry, setGeometry] = useState<number | null>(fixture?.draft.geometry ?? null);
  const [decimalGrid, setDecimalGrid] = useState<number | null>(fixture?.draft.decimalGrid ?? null);
  const [decimalPlace, setDecimalPlace] = useState<DecimalPlaceState | null>(fixture?.draft.decimalPlace ?? null);
  const [placeValue, setPlaceValue] = useState<PlaceValueState | null>(fixture?.draft.placeValue ?? null);
  const fractionPieces = fractionSelectedSlices.length;
  const [pairIndices, setPairIndices] = useState<number[]>(fixture?.draft.pairIndices ?? []);
  const [numberOrder, setNumberOrder] = useState<number[]>(() =>
    fixture?.draft.order ?? createInitialOrder(puzzle),
  );
  const [selectedByPair, setSelectedByPair] = useState<readonly (readonly number[])[]>(
    () => fixture?.draft.selectedByPair ?? [],
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
    setResponseValue(null); setPendingChoice(null); setPendingNumberLine(null); setSelectedOperators(createEmptyOperators(nextPuzzle));
    setBridge(null); setGeometry(null); setDecimalGrid(null); setDecimalPlace(null); setFractionStrip(null); setPlaceValue(null);
    setHeadingOffscreen(false); setSnapshot(null); setDecimalCells([]); setDistribution([]);
    setChallengeAnswer(null); setFoundPairs([]); setPairIndices([]); setFractionSelectedSlices([]);
    setNumberOrder(createInitialOrder(nextPuzzle)); setSelectedByPair([]);
    setLastAttempt(null); setEditingRetry(false); setRetryCount(0); setIsDraggingTile(false); setSolutionShown(false); setOpenResult(false); setAnswered(false); setIsCorrect(false);
    setCoinsEarned(0); setShowVisualHelp(false); setShowLives(false);
  }
  useEffect(() => {
    submittedAnswer.current = null;
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
    setResponseValue(null); setPendingChoice(null); setPendingNumberLine(null); setSelectedOperators(createEmptyOperators(puzzle));
    setBridge(null); setGeometry(null); setDecimalGrid(null); setDecimalPlace(null); setFractionStrip(null); setPlaceValue(null);
    setHeadingOffscreen(false); setSnapshot(null); setDecimalCells([]); setDistribution([]);
    setChallengeAnswer(null); setFoundPairs([]); setPairIndices([]); setFractionSelectedSlices([]);
    setNumberOrder(createInitialOrder(puzzle)); setSelectedByPair([]);
    setLastAttempt(null); setEditingRetry(false); setRetryCount(0); setIsDraggingTile(false); setSolutionShown(false); setOpenResult(false); setAnswered(false); setIsCorrect(false);
    submittedAnswer.current = null;
    attemptId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [beginChallenge, level.id, puzzle, recordInteraction, challengeMode]);
  const handleResumeChallenge = useCallback(() => {
    const location = run && getChallengePathLocation(run);
    if (location) router.replace({ pathname: "/play", params: { difficulty: location.lesson.difficulty, lesson: location.lesson.id, level: location.level.id } });
  }, [run, router]);

  const visualHelpCost = getVisualHelpCost(difficulty);
  const visualHelpUnlocked = true;
  const hasVisualHelp = hasVisualExplanation(puzzle);

  const draft = useMemo(() => ({
    response: responseValue, distribution,
    bridge, geometry, decimalGrid, decimalPlace, fractionStrip, placeValue, choice: pendingChoice, operators: selectedOperators, shaded: fractionPieces,
    numberLine: pendingNumberLine, pairIndices, order: numberOrder,
    matchedCount: 0, selectedByPair, pairs: foundPairs, challenge: challengeAnswer,
  }), [responseValue, distribution, bridge, geometry, decimalGrid, decimalPlace, fractionStrip, placeValue, pendingChoice, selectedOperators, fractionPieces, pendingNumberLine, pairIndices, numberOrder, selectedByPair, foundPairs, challengeAnswer]);
  const draftAnswer = useMemo(() => getPuzzleDraftAnswer(puzzle, draft), [puzzle, draft]);
  const draftKey = checkedAnswerKey(draftAnswer);
  if (snapshot && !snapshot.correct && checkedAnswerKey(snapshot.answer) !== draftKey) setSnapshot(null);
  const showMistake = !answered && lastAttempt !== null && draftKey === lastAttempt.key &&
    !(editingRetry && puzzle.response?.kind === 'write');
  const offerRetry = hasLives && showMistake && !editingRetry;
  const displayQuestion = effectivePuzzlePrompt(puzzle, t);
  const playback = snapshot && (snapshot.correct || (showMistake && !editingRetry)) ? snapshot : null;
  const missed = playback?.correct === false;
  const placeValueFamily = puzzle.type === 'place_value' || puzzle.type === 'decimal_place_value';
  const placeValueMiss = !!playback && !playback.correct && placeValueFamily;
  // Judge puzzles keep their one entry question in every state (signed_line wave 9, coordinate translate wave 13):
  // the claim sits in the dock and the verdict chip, never in the question, so the stage never reflows after Check.
  const checkedQuestion = displayQuestion;
  const kind = getPuzzleType(puzzle);
  const scalarBridge = puzzle.type === 'ratio_table' || (puzzle.type === 'coordinate_map' && puzzle.payload.mode === 'distance');
  const nativeClaim = puzzle.type === 'true_false' && !puzzle.response;
  const keepsResponse = !!puzzle.response || scalarBridge || nativeClaim || ['multiple_choice', 'geometry_measure', 'fraction_equivalent'].includes(kind);
  const storyModel = hasStoryReveal(puzzle);
  const story = !!playback?.correct && storyModel;
  const limitMiss = !!playback && !playback.correct && isLimitStory(puzzle);
  const storyHostsAnswer = !playback && hasStoryAnswerWell(puzzle);
  const compactQuestion = fontScale >= 1.2;
  const keypadOpen = !playback && (puzzle.response?.kind === 'write' || scalarBridge ||
    (puzzle.type === 'geometry_measure' && puzzle.payload.mode !== 'compare'));
  const compactPrompt = compactQuestion && puzzle.type === 'multiple_choice' && puzzle.topic === 'patterns' && !puzzle.taskVisual && !puzzle.everyday
    ? splitNumberSequence(checkedQuestion)?.question ?? checkedQuestion : checkedQuestion;
  // Keep the model in view while the full question remains one tap away.
  const quantityScene = puzzle.type === 'compare' || puzzle.type === 'fair_share' || (puzzle.type === 'multiple_choice' && !!puzzle.taskVisual);
  const checkedQuantityBoard = !!playback && quantityScene;
  const compactQuantityRetry = quantityScene && showMistake && hasLives;
  // Use the same header and model origin before and after a submission.
  const hasQuestionShortcut = fontScale >= 2;
  const quantityAction = puzzle.type === 'compare' ? 'compare' : puzzle.type === 'fair_share' ||
    (puzzle.type === 'multiple_choice' && puzzle.taskVisual?.kind === 'share') ? 'share' : 'count';
  const capacityTask = capacity && everydayModel.task === 'servings' && everydayModel.portionContainer === 'bowl' ? 'bowls' : capacity ? everydayModel.task : undefined;
  const shoppingTask = puzzle.type === 'budget_plan' ? 'budget' : money ? everydayModel.task : undefined;
  const questionTitle = capacityTask ? t(`jugSolution.subject.${capacityTask}`)
    : shoppingTask ? t(`play.moneySubject.${shoppingTask}`)
    : quantityScene ? t(`play.questionAction.${quantityAction}`) : t('play.questionLabel');
  const fractionStory = !!fractionChoiceMechanic(puzzle);
  const headerStory = hasClockStoryPrompt(puzzle) || shopping || fractionStory;
  // These short fraction models leave room for the question in the scroll area.
  // Keep its native layout through Check and replay so the rail keeps its entry baseline.
  const checkedGroupTape = hasQuestionShortcut && playback?.correct && puzzle.type === 'multiple_choice' && !!puzzle.fractionExample?.whole;
  const keepInlineQuestion = puzzle.type === 'fraction_number_line' || puzzle.type === 'fraction_equivalent' || fractionStory;
  // Fraction pictures stay anchored to the same prompt in both phases.
  // Grid misses are drawn on the same board at the same size and origin (wave 4), so they keep the entry stage and scroll.
  const sameModelMiss = missed && (kind === 'coordinate_map' || kind === 'route_grid' || kind === 'true_false' || kind === 'operation_path' || kind === 'target_build' || kind === 'pair_sum' || kind === 'find_all_pairs' || storyModel || ['geometry_measure', 'fraction_build', 'fraction_match', 'fraction_equivalent', 'fraction_strip', 'fraction_number_line', 'number_line', 'signed_line', 'estimate', 'pattern_next', 'order_numbers', 'repair_pattern', 'sort_buckets'].includes(kind)
    || everydayModel?.kind === 'shapes' || everydayModel?.kind === 'solid' || (puzzle.type === 'multiple_choice' && !!puzzle.fractionExample)
    || kind === 'balance' || kind === 'function_machine' || kind === 'equation_board' || kind === 'decimal_grid' || kind === 'decimal_place_value' || kind === 'place_value'
    || (puzzle.type === 'multiple_choice' && puzzle.percentageExample?.kind === 'amount' && [10, 25, 50].includes(puzzle.percentageExample.percent)) || everydayModel?.kind === 'grid' || everydayModel?.kind === 'bars'
    || (everydayModel?.kind === 'money' && ['change', 'total', 'discount', 'afford', 'unit'].includes(everydayModel.task)));
  const scrollQuestion = (!missed || sameModelMiss) && hasQuestionShortcut && !keepInlineQuestion && !placeValueFamily;
  // The XL clock keeps the same prompt height and scroll target through Check.
  const storyQuestion = headerStory && (!playback || shopping || fractionStory || (hasQuestionShortcut && everydayModel?.kind === 'clock'));
  const boardOnly = hasQuestionShortcut && quantityScene && !puzzle.contextObjects?.length;
  // The ScrollView is laid out between the safe-area header and the complete dock.
  // Its measured height already excludes the caption, submission, playback and result actions.
  // PuzzleCard draws these givens above the task slot. Measuring from the slot
  // would subtract the picture itself from the height offered to that picture.
  const checkedExample = !!playback && puzzle.type === 'multiple_choice' && !puzzle.taskVisual && !puzzle.everyday &&
    (!!puzzle.percentageExample || fractionChoiceMechanic(puzzle) === 'whole-choice');
  const pictureInCard = storyModel || (!checkedExample && !playback?.correct && puzzle.type === 'multiple_choice' &&
    !puzzle.taskVisual && !puzzle.everyday && !!(puzzle.percentageExample || puzzle.fractionExample));
  const cardPromptBottom = compactQuestion ? largePromptBottom : promptBottom;
  const modelTop = pictureInCard && cardPromptBottom > 0 ? cardPromptBottom : modelSlot.top;
  // Align diagrams with the measured task slot, including its spacing after the prompt.
  const operationFocus = kind === 'target_build' || kind === 'fix_mistake';
  const entryFocus = operationFocus || puzzle.type === 'coordinate_map' || everydayModel?.kind === 'solid' || (!playback && everydayModel?.kind === 'clock' && puzzle.response?.kind === 'judge')
    ? modelSlot.top : largePromptBottom > 0 ? largePromptBottom + moderateScale(8) : 0;
  // Keep short headings with the board. Tall editors and checked drawings can
  // use the whole stage, with the complete prompt one scroll or one tap away.
  const focusModel = operationFocus || puzzle.type === 'coordinate_map' || boardOnly || keypadOpen || shopping || storyModel || everydayModel?.kind === 'clock'
    || everydayModel?.kind === 'solid' || puzzle.type === 'geometry_measure'
    || puzzle.type === 'place_value' || puzzle.type === 'decimal_place_value'
    || (taskHeight > 0 && scrollHeight > 0 && modelSlot.top + taskHeight + moderateScale(8) > scrollHeight);
  const rawFocusOffset = scrollQuestion && focusModel ? entryFocus : 0;
  // Same-model misses keep the scroll offset measured at entry, so the board never moves after Check.
  const [entryScroll, setEntryScroll] = useState<{ id: string; offset: number } | null>(null);
  if (!playback && (entryScroll?.id !== puzzle.id || entryScroll.offset !== rawFocusOffset)) {
    setEntryScroll({ id: puzzle.id, offset: rawFocusOffset });
  }
  // XL: once a verdict shows, the question shrinks to one 44 pt line so the model keeps the height the dock would take.
  // The full text stays one tap away (the same dialog as the dock's book). Large and entry are untouched.
  const collapseQuestion = hasQuestionShortcut && !!playback && !checkedGroupTape && !keepInlineQuestion && !storyQuestion && !placeValueFamily
    && fullPromptHeight > COLLAPSED_QUESTION_HEIGHT;
  const collapsedPromptDelta = collapseQuestion ? fullPromptHeight - COLLAPSED_QUESTION_HEIGHT : 0;
  // Grid boards keep the entry stage on BOTH verdicts, so the correct and the miss settle at the same y (wave 11, XL).
  const sameModelStage = sameModelMiss || (!!playback && !missed && (kind === 'coordinate_map' || everydayModel?.kind === 'grid'));
  const baseFocusOffset = sameModelStage && entryScroll?.id === puzzle.id ? entryScroll.offset : rawFocusOffset;
  // The collapsed question shifts the model up by the height it frees, so the scroll shifts with it and the model keeps its place.
  const focusOffset = Math.max(0, baseFocusOffset - collapsedPromptDelta);
  // The measured scroll height already excludes the verdict and the rest of the dock.
  const bottomPadding = boardOnly ? 0 : moderateScale(20);
  const remainingHeight = Math.max(0, scrollHeight - modelTop - bottomPadding);
  const availableModelHeight = missed ? remainingHeight : boardOnly ? scrollHeight : Math.max(compactQuestion ? scrollHeight * 0.45 : 0,
    scrollHeight - Math.max(0, modelTop - focusOffset) - (checkedQuantityBoard ? 0 : moderateScale(20)));
  // Reserve a submitted chip, one caption, replay and the primary action before Check.
  // A taller editor (for example a keypad) already reserves its actual measured dock.
  const checkedDockHeight = 44 + 48 + moderateScale(56 + 32 + 3 * 12 + 2 * 8);
  const entryHeight = Math.max(0, availableModelHeight - Math.max(0, checkedDockHeight - dockHeight));
  const stageKey = `${puzzle.id}:${modelSlot.width}:${fontScale}`;
  const entryStageHeight = playback?.stage.key === stageKey ? playback.stage.height : entryHeight;
  const stageHeight = missed && !sameModelMiss ? Math.min(entryStageHeight || availableModelHeight, availableModelHeight) : entryStageHeight;
  const stageLayout = { width: modelSlot.width, height: hasQuestionShortcut ? availableModelHeight : stageHeight,
    checked: !!playback, constrainHeight: (missed && !sameModelMiss) || (!!playback && hasQuestionShortcut && !sameModelStage),
    // Place-value mats are top-aligned in their stage: entry, proof and both verdicts share one origin (wave 9).
    scrollToModel: hasQuestionShortcut || placeValueFamily };
  const viewportHeight = placeValueFamily
    ? Math.max(0, availableModelHeight - 12)
    : !hasQuestionShortcut && stageHeight > 0 ? stageHeight : availableModelHeight;
  const proofViewport = useMemo(() => modelSlot.width > 0 && scrollHeight > 0 ? {
    innerWidth: modelSlot.width, availableModelHeight: viewportHeight, fontScale,
  } : null, [modelSlot.width, scrollHeight, viewportHeight, fontScale]);
  const attemptKey = playback?.submissionId;
  const focusKey = attemptKey ?? puzzle.id;
  const focusCheckedPicture = useCallback(() => {
    if (focusOffset > 0 && manuallyScrolledAttempt.current !== focusKey) {
      taskScroll.current?.scrollTo({ y: focusOffset, animated: false });
    }
  }, [focusKey, focusOffset]);
  useLayoutEffect(() => { manuallyScrolledAttempt.current = undefined; }, [attemptKey]);
  useLayoutEffect(focusCheckedPicture, [focusCheckedPicture]);
  const largeTypePlayback = !!attemptKey && fontScale >= 2;
  // At XL these checked boards need the full stage to preserve their countable cells and tiles.
  const scrollDenseProof = largeTypePlayback && !missed && !puzzle.response && (
    (puzzle.type === 'decimal_grid' && puzzle.payload.scale === 100) ||
    (puzzle.type === 'sort_buckets' && puzzle.payload.rule === 'fractions')
  );
  const largeRetryEditor = editingRetry && hasLives && !playback && fontScale >= 2;
  const initialModelPainted = useCallback((runId: number) => {
    proofAudit?.record({ phase: 'painted', runId });
    setPaintedAttempt(attemptKey);
  }, [attemptKey, proofAudit]);
  const revealHost = useMemo(() => ({
    attemptKey, onProofFrame: proofAudit?.record, onInitialModelPainted: initialModelPainted, Controls: controlHost.Controls,
    onReplay: () => {
      manuallyScrolledAttempt.current = undefined;
      if (scrollDenseProof) taskScroll.current?.scrollTo({ y: 0, animated: false });
      else focusCheckedPicture();
      setSolutionShown(false);
    },
    landingHaptics: liveFeedback || !!proofAudit,
  }), [attemptKey, initialModelPainted, proofAudit, controlHost, liveFeedback, focusCheckedPicture, scrollDenseProof]);
  const inlineModel = (puzzle.type === 'multiple_choice' || !puzzle.type) && !!(puzzle.everyday || puzzle.taskVisual);
  const evidence = playback && <CheckedPuzzleReveal modelOnly snapshot={playback} mode={playback.correct ? 'worked' : 'attempt'} onSolutionShown={markSolutionShown} />;
  // Keep scalar givens visible on a miss. Boards with movable pieces instead show the frozen attempt.
  const replaceModel = playback?.correct || nativeClaim || kind === 'fair_share' || kind === 'coordinate_map' || kind === 'ratio_table'
    || kind === 'number_line' || kind === 'signed_line' || kind === 'fraction_equivalent' || checkedExample
    || (placeValueFamily && !!puzzle.response);
  const checkedModel = replaceModel && !story && !inlineModel ? evidence : undefined;
  const sharingScene = puzzle.type === 'multiple_choice' && puzzle.taskVisual?.kind === 'share';
  const carriesEditorDrawing = operationFocus || ['budget_plan', 'compare', 'fair_share', 'fraction_build', 'fraction_strip', 'fraction_equivalent', 'fraction_match', 'fraction_number_line'].includes(kind)
    || kind === 'geometry_measure' || capacity || everydayModel?.kind === 'grid' || everydayModel?.kind === 'shapes' || everydayModel?.kind === 'solid'
    || sharingScene || everydayModel?.kind === 'clock' || (!!puzzle.response && everydayModel?.kind === 'money');
  const replacingDrawing = !!playback && (playback.correct || !keepsResponse || capacity || money || everydayModel?.kind === 'grid'
    || (everydayModel?.kind === 'clock' && !puzzle.response));
  const awaitingDrawing = !!playback && attemptKey !== paintedAttempt;
  const retainingOuterEditor = carriesEditorDrawing && replacingDrawing && awaitingDrawing;
  const retainPracticeDrawing = awaitingDrawing && (!!playback?.correct || money);
  const retainingShoppingEditor = shopping && (retainingOuterEditor || (money && !puzzle.response && retainPracticeDrawing));
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

  const recordHelp = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    recordLearningHelp(puzzle.id);
  }, [recordInteraction, recordLearningHelp, puzzle.id]);

  const handleOpenVisualHelp = useCallback(() => {
    if (answered || !hasVisualHelp) return;
    recordHelp();
    setShowVisualHelp(true);
  }, [answered, hasVisualHelp, recordHelp, setShowVisualHelp]);

  const handlePurchaseVisualHelp = useCallback(() => {
    recordInteraction();
    return purchaseVisualHelp(puzzle.id, visualHelpCost);
  }, [purchaseVisualHelp, puzzle.id, recordInteraction, visualHelpCost]);

  const exitToPath = useCallback(() => {
    if (preview) preview.onExit();
    else router.dismissTo({ pathname: "/puzzles", params: { difficulty, topic: lesson.topicId } });
  }, [difficulty, lesson.topicId, router, preview]);

  const handleCheckAnswer = useCallback(() => {
    if (!canCheck || !draftAnswer || submittedAnswer.current === draftKey) return;
    // Guard duplicate taps before React has painted the disabled button.
    submittedAnswer.current = draftKey;
    if (proofAudit) {
      const choiceIndex = draftAnswer.kind === 'choice' ? draftAnswer.index
        : draftAnswer.kind === 'response' && puzzle.response?.kind === 'choose' ? Number(draftAnswer.value) : undefined;
      const choiceCount = puzzle.response?.kind === 'choose' ? puzzle.response.options.length
        : 'choices' in puzzle ? puzzle.choices.length : 'choices' in puzzle.payload ? puzzle.payload.choices.length : undefined;
      proofAudit.record({ phase: 'check' }, { locale, fontScale, reducedMotion, choiceIndex, choiceCount,
        submitted: submittedLabel({ puzzle, answer: draftAnswer }, t, locale), answerKind: draftAnswer.kind });
    }
    const correct = checkPuzzleAnswer(puzzle, draftAnswer);
    const submissionId = attemptId.current;
    if (!applyAnswerResult({ correct, puzzle, haptics: liveFeedback, attemptId: submissionId, answerPuzzle, setCoinsEarned, setIsCorrect })) {
      submittedAnswer.current = null;
      return;
    }
    const attempt = freezeCheckedAttempt(puzzle, displayQuestion, draft, draftAnswer, {
      selectedSlices: fractionSelectedSlices, decimalCells, distribution, matchedIds: [],
    }, correct);
    if (!correct) {
      taskScroll.current?.scrollTo({ y: 0, animated: false });
    } else if (everydayModel?.kind === 'clock' && focusOffset > 0) {
      taskScroll.current?.scrollTo({ y: focusOffset, animated: false });
    }
    setSnapshot({ ...attempt, submissionId, stage: { key: stageKey, height: entryHeight } });
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
  }, [canCheck, draftAnswer, draftKey, puzzle, proofAudit, locale, fontScale, reducedMotion, answerPuzzle, t, retryCount, liveFeedback, displayQuestion, draft, fractionSelectedSlices, decimalCells, distribution, stageKey, entryHeight, everydayModel, focusOffset]);

  const autoSubmitted = useRef(false);
  const changeChallengeAnswer = useCallback((next: ChallengeAnswer | null) => {
    if (fixture && !autoSubmitted.current && next === null) return;
    setChallengeAnswer(next);
  }, [fixture]);
  useEffect(() => {
    if (!fixture || autoSubmitted.current || !canCheck || !isReady || !(fontsLoaded || fontError)) return;
    const timer = setTimeout(() => {
      autoSubmitted.current = true;
      handleCheckAnswer();
    }, 650);
    return () => clearTimeout(timer);
  }, [fixture, canCheck, isReady, fontsLoaded, fontError, handleCheckAnswer]);

  const handleInlineMistake = useCallback(() => {
    const accepted = applyAnswerResult({ correct: false, puzzle, haptics: liveFeedback,
      attemptId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      answerPuzzle, setCoinsEarned, setIsCorrect });
    if (accepted) setRetryCount(count => count + 1);
    return accepted;
  }, [answerPuzzle, puzzle, liveFeedback]);

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

  const handleToggleWedge = useCallback((pairIndex: number, wedge: number) => {
    if (playback || answered || !hasLives || puzzle.type !== 'fraction_match') return;
    const pairs = puzzle.payload.pairs;
    const pair = pairs[pairIndex];
    if (!pair || !Number.isInteger(wedge) || wedge < 0 || wedge >= pair.denominator) return;
    setSelectedByPair(current => pairs.map((_, i) => i === pairIndex
      ? toggleFractionSlice(current[i] ?? [], wedge) : current[i] ?? []));
  }, [playback, answered, hasLives, puzzle]);

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
    practiceFinished: lessonFinished,
    replay: isReplay,
    retries: retryCount,
    completedCount: new Set(entryCompleted).size + (isCorrect && !isReplay ? 1 : 0),
    puzzleId: puzzle.id,
  });
  const pictureHelpAvailable = challengePlayable && !answered && !playback && hasVisualHelp;
  const operationsMiss = playback && !playback.correct && ['find_all_pairs', 'fix_mistake', 'operation_path', 'pair_sum', 'ratio_table', 'target_build', 'true_false'].includes(kind);
  const compactProofHint = playback && !playback.correct && (checkedExample || everydayModel?.kind === 'grid' ||
    ['coordinate_map', 'route_grid', 'fraction_build', 'fraction_equivalent', 'fraction_match', 'number_line', 'signed_line'].includes(kind));
  const staticQuantityMiss = playback && !playback.correct && puzzle.type === 'multiple_choice' && !puzzle.response &&
    (puzzle.taskVisual?.kind === 'join' || puzzle.taskVisual?.kind === 'take_away' || puzzle.taskVisual?.kind === 'array' || sharingScene);
  const challengeIntroProps = { level, title: lesson.topicId === 'cat-plans' ? lesson.title[locale] : undefined,
    description: lesson.topicId === 'cat-plans' ? lesson.description[locale] : undefined,
    mode: challengeMode, onModeChange: setChallengeMode, expired: !!expired, lifeLost: !!run?.lifeLost, hasLives, otherActive,
    onStart: handleBeginChallenge, onResume: handleResumeChallenge, onRefill: () => setShowLives(true) };

  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  const compactPlaceAnswer = largeTypePlayback && placeValueFamily;
  // Picture help sits beside Check so the header keeps its width for the lesson progress rail.
  const pictureHelp = pictureHelpAvailable && (<Pressable testID="puzzle-picture-help" style={[styles.headerHelp, styles.helpChip]} onPress={handleOpenVisualHelp}
    accessibilityRole="button" accessibilityLabel={t("visualHelp.a11yOpen")}
    accessibilityHint={visualHelpUnlocked ? undefined : t("visualHelp.unlockPrice", { cost: visualHelpCost })}>
    <Text accessible={false} allowFontScaling={false} style={styles.helpMark}>?</Text>
  </Pressable>);
  const questionShortcut = <Pressable testID={placeValueFamily ? "play-question-shortcut" : "puzzle-question"} accessibilityRole="button" accessibilityLabel={checkedQuestion}
    accessibilityHint={t('everyday.readQuestionAgain')} style={styles.headerHelp}
    onPress={() => Alert.alert(questionTitle, checkedQuestion, [{ text: t('common.close') }])}>
    {headerStory ? <View testID="play-question-cat" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <DiagramIcon name="cat" size={28} />
    </View> : <DiagramIcon name="book" size={28} />}
  </Pressable>;
  const answerDock = challengePlayable ? (
    <View collapsable={false} testID="play-answer-dock" onLayout={event => setDockHeight(event.nativeEvent.layout.height)} nativeID={proofAudit && scrollDenseProof ? "play-proof-scrolling-dock" : undefined} style={[styles.answerDock, (compactQuestion || keypadOpen || checkedQuantityBoard) && styles.compactDock]}>
      {playback && !retainingShoppingEditor && <PlaybackDock host={captionHost} nativeID={proofAudit && "play-proof-caption"} />}
      {playback ? <View nativeID={proofAudit && "play-proof-answer"} testID="play-submitted-response" style={styles.submission}>
        <ChoiceButton label={submittedLabel(playback, t, locale, compactPlaceAnswer)}
          accessibilityAnswer={compactPlaceAnswer ? submittedLabel(playback, t, locale) : undefined} result={playback.correct ? 'correct' : 'wrong'} selected disabled
          style={styles.submittedChoice} fitSubmission={compactQuestion && !compactPlaceAnswer} fitLabel={compactPlaceAnswer}
          labelStyle={largeTypePlayback ? styles.largeTypeSubmission : undefined} onPress={ignorePress} />
      </View> : everydayModel?.kind === 'clock' && puzzle.response?.kind === 'judge' ? <View>
        <PlaybackDock host={answerHost} />
        {!editingRetry && <ClockResponseHint kind="judge" interacted={responseValue !== null} />}
      </View> : <PlaybackDock host={answerHost} />}
      {playback && (largeTypePlayback || compactQuantityRetry || compactProofHint ? <View style={styles.proofTools}>
        <View style={styles.hostedPlayback}><PlaybackDock host={controlHost} reserveControls={playback.correct} nativeID={proofAudit && "play-proof-controls"} /></View>
        {showMistake && !placeValueMiss && !staticQuantityMiss && !hasEverydayAttempt && !shopping && <Pressable accessibilityRole="button" accessibilityLabel={t('play.hintButton')} accessibilityHint={lastAttempt.hint}
          onPress={() => Alert.alert(t('play.hintButton'), lastAttempt.hint)} style={styles.detailButton}>
          <Text allowFontScaling={false} style={styles.detailIcon}>?</Text>
        </Pressable>}
      </View> : <PlaybackDock host={controlHost} reserveControls={playback.correct} nativeID={proofAudit && "play-proof-controls"} />)}
      {capacity && !hasQuestionShortcut && headingOffscreen && !playback && <Pressable accessibilityRole="button" style={styles.readAgain} onPress={readQuestionAgain}>
        <Text style={styles.lifeActionText}>{t('everyday.readQuestionAgain')}</Text>
      </Pressable>}
      {!answered && lives.current === 0 ? <View style={styles.emptyLives} accessibilityLiveRegion="polite">
        <Text style={styles.attemptTitle}>{t("lives.outOfLives")}</Text>
        <Text style={styles.attemptHint}>{t("lives.checkPaused")}</Text>
        {nextLife !== null ? <Text style={styles.lifePolicy}>{t("lives.nextLifeIn", { time: formatRegenCountdown(nextLife) })}</Text> : null}
      </View> : null}
      {lives.current > 0 && showMistake && !sameModelMiss && !placeValueMiss && !hasEverydayAttempt && !operationsMiss && !compactProofHint && !shopping && !largeTypePlayback && !largeRetryEditor && !compactQuantityRetry ? (
        // One caption only (owner simplicity rule): the verdict chip already says "not quite", so show just the hint.
        <View style={styles.attemptFeedback} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${t("play.adjustAnswer")} ${lastAttempt.hint ?? ""}`}>
          <View style={styles.attemptCopy}>
            <Text style={[styles.attemptHint, styles.attemptHintOnly]}>{lastAttempt.hint}</Text>
          </View>
        </View>
      ) : null}
      {!answered && !largeRetryEditor && (retryCount >= 2 || lives.current === 0) && hasVisualHelp ? <Pressable onPress={handleOpenVisualHelp} accessibilityRole="button" style={styles.lifeAction}>
        <Text style={styles.lifeActionText}>{t("lives.workedExample")}</Text>
      </Pressable> : null}
      <View style={(compactQuestion || pictureHelpAvailable) && styles.actionRow}>
        {hasQuestionShortcut && questionShortcut}
        {pictureHelp}
        <PuzzleButton
          nativeID={proofAudit && "play-proof-result"}
          wrapIcon={hasQuestionShortcut && !playback && hasLives && !offerRetry ? "✓" : undefined}
          label={t(showingSolution ? (largeTypePlayback ? "play.shortResult" : "play.seeResult") : !hasLives ? "lives.refillToRetry" : offerRetry ? "play.tryAgain" : fontScale >= 2 ? "play.shortCheck" : "play.checkAnswer")}
          style={[(compactQuestion || pictureHelpAvailable) && styles.actionButton, largeTypePlayback && styles.largeTypeResult]}
          accessibilityLabel={t(showingSolution ? "play.seeResult" : !hasLives ? "lives.refillToRetry" : offerRetry ? "play.tryAgain" : "play.checkAnswer")}
          accessibilityState={{ disabled: !showingSolution && hasLives && !offerRetry && !canCheck }}
          disabled={!showingSolution && hasLives && !offerRetry && !canCheck}
          onPress={() => {
            if (showingSolution) { setOpenResult(true); return; }
            if (!hasLives) { setShowLives(true); return; }
            if (offerRetry) {
              if (snapshot?.draft.selectedByPair) setSelectedByPair(snapshot.draft.selectedByPair);
              setPaintedAttempt(undefined);
              setSnapshot(null);
              setEditingRetry(true);
              taskScroll.current?.scrollTo({ y: 0, animated: false });
              return;
            }
            handleCheckAnswer();
          }}
        />
      </View>
      {!answered && !largeRetryEditor && (!hasLives || (retryCount > 0 && !largeTypePlayback && !compactQuantityRetry)) ? <Pressable onPress={exitToPath} accessibilityRole="button" style={styles.lifeAction}>
        <Text style={styles.lifeActionText}>{t("play.backToPath")}</Text>
      </Pressable> : null}
    </View>
  ) : (
    <View style={styles.answerDock}>
      <TimedChallengeActions {...challengeIntroProps} />
      <Pressable onPress={exitToPath} accessibilityRole="button" style={styles.lifeAction}>
        <Text style={styles.lifeActionText}>{t("play.backToPath")}</Text>
      </Pressable>
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <PuzzleHeaderGlow color={GameColors.playGlow} />
      <View ref={proofAudit?.bindScreen} style={styles.screen}>
        <View testID="play-navigation" style={[styles.header, compactQuestion && styles.clockHeader]}>
          <Pressable
            onPress={handleExitToPath}
            disabled={answered}
            style={[styles.backBtn, answered && styles.backBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("play.a11yBack")}
            accessibilityState={{ disabled: answered }}
          >
            <AppIcon name="arrow-left" size={moderateScale(26)} />
          </Pressable>
          {!compactQuestion && <View style={styles.headerProgress}>
            <PuzzleProgress steps={progressSteps} total={position.total}
              label={t("play.puzzleOf", { number: position.current, total: position.total })} />
          </View>}
          <PuzzleLives lives={lives} onPress={() => { recordInteraction(); setShowLives(true); }} />
        </View>
        {run?.status === "active" && run.mode !== "untimed" && (atChallenge || inTimedRun) ? <ChallengeClock milliseconds={run.deadlineAt - now} /> : null}

        <View testID="play-model-stage" style={[styles.proofStage, !playback && styles.editingStage]}>
        <ScrollView
          ref={taskScroll}
          testID="play-model-scroll"
          nativeID={proofAudit && "play-proof-scroll"}
          innerViewRef={scrollContent}
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            setScrollHeight(height);
            reportLayout({ viewportHeight: height });
          }}
          onContentSizeChange={(_width, height) => {
            setContentHeight(height);
            reportLayout({ contentHeight: height });
            // An asynchronous proof can grow after the first scroll was clamped to the old content size.
            focusCheckedPicture();
          }}
          onScrollBeginDrag={() => { manuallyScrolledAttempt.current = focusKey; }}
          onScroll={capacity ? event => {
            headingPosition.current.scroll = event.nativeEvent.contentOffset.y;
            updateQuestionLink();
          } : undefined}
          scrollEventThrottle={capacity ? 32 : undefined}
          scrollEnabled={!isDraggingTile && (!missed || (hasQuestionShortcut && contentHeight > scrollHeight + 1))}
          style={styles.scroll}
          contentContainerStyle={styles.scrollFill}
          showsVerticalScrollIndicator={false}
        >
          <ExchangeScrollContext.Provider value={missed ? null : scrollToExchange}>
          <PuzzleContentTransition key={puzzle.id} slide={!(hasQuestionShortcut && keepInlineQuestion)} style={[styles.scrollContent, boardOnly && styles.boardContent]}
            onLayout={onLayoutMeasured ? event => reportLayout({ contentHeight: event.nativeEvent.layout.height }) : undefined}>
          {!challengePlayable ? <TimedChallengeIntro {...challengeIntroProps} /> : <>
          <QuantityPracticeProvider key={puzzle.id}>
          <RevealPlayContext.Provider value={revealHost}>
          <ProofViewportContext.Provider value={proofViewport}>
          <PlayProofCaptionContext.Provider value={playback ? captionHost.publish : null}>
          {compactQuestion && !checkedGroupTape && <View testID={hasQuestionShortcut && !placeValueFamily ? 'play-full-question' : 'puzzle-question'}
            onLayout={collapseQuestion ? undefined : ({ nativeEvent: { layout } }) => { setLargePromptBottom(layout.y + layout.height); setFullPromptHeight(layout.height); }}>
            {collapseQuestion ? <Pressable accessibilityRole="button" accessibilityLabel={checkedQuestion} accessibilityHint={t('everyday.readQuestionAgain')}
              style={styles.collapsedQuestion} onPress={() => Alert.alert(questionTitle, checkedQuestion, [{ text: t('common.close') }])}>
              <Text allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={styles.collapsedQuestionText}>{compactPrompt}</Text>
              <DiagramIcon name="book" size={28} />
            </Pressable> : storyQuestion ? <StoryHost text={compactPrompt} /> : <Text accessibilityRole="header"
              maxFontSizeMultiplier={placeValueFamily ? 1.65 : undefined} style={styles.fullPrompt}>{compactPrompt}</Text>}
          </View>}
          {!boardOnly && <View ref={headingRef} pointerEvents={playback && !playback.correct ? "none" : "auto"} accessible={capacity && !compactQuestion} accessibilityRole={capacity && !compactQuestion ? 'header' : undefined}
            accessibilityLabel={capacity && !compactQuestion ? displayQuestion : undefined} onLayout={capacity ? event => {
              const { y, height } = event.nativeEvent.layout;
              headingPosition.current.top = y;
              headingPosition.current.bottom = y + height;
              updateQuestionLink();
            } : undefined}>
            <PuzzleCard showIdleCue={!playback && !editingRetry && pendingChoice == null && responseValue == null} stageLayout={pictureInCard ? stageLayout : undefined} checked={!!playback}
              submittedStoryValue={playback && !playback.correct && playback.answer.kind === 'response' ? String(playback.answer.value) : undefined}
              writtenAnswer={storyHostsAnswer ? <WrittenAnswer puzzle={puzzle} value={responseValue} /> : undefined} onPromptLayout={setPromptBottom} hideQuestion={compactQuestion} solved={story} showObjects={(!checkedExample && !playback?.correct) || story || !!inlineModel} checkedIndex={playback?.answer.kind === 'choice' ? playback.answer.index : null} onSolutionShown={story || limitMiss ? markSolutionShown : undefined} puzzle={checkedQuestion === puzzle.question ? puzzle : { ...puzzle, question: checkedQuestion }} />
          </View>}

          <View collapsable={false} testID={pictureInCard ? undefined : 'play-proof-area'} style={[styles.taskArea, scrollQuestion && focusModel && { minHeight: scrollHeight }]} onLayout={event => {
            const { width, y } = event.nativeEvent.layout;
            setModelSlot(previous => previous.width === width && previous.top === y ? previous : { width, top: y });
          }}>
            {!playback && !puzzle.response && !["compare", "pattern_next", "pair_sum", "target_build", "true_false", "order_numbers", "multiple_choice", "balance", "fraction_build", "fraction_equivalent", "fraction_match", "number_line", "fraction_number_line", "fair_share", "function_machine", "fix_mistake", "estimate", "place_value", "fraction_strip", "decimal_grid", "decimal_place_value", "geometry_measure", "sort_buckets", "repair_pattern", "route_grid", "budget_plan", "operation_path", "find_all_pairs", "ratio_table", "signed_line", "coordinate_map", "equation_board"].includes(getPuzzleType(puzzle)) && !('payload' in puzzle && puzzle.payload && 'guided' in puzzle.payload && puzzle.payload.guided) && !entryCompleted.some(
              (id) =>
                puzzles.find((item) => item.id === id)?.type === puzzle.type,
            ) && (
              <Text style={styles.mechanicIntro}>
                {t(`play.mechanicIntro.${getPuzzleType(puzzle)}`)}
              </Text>
            )}
            <View onLayout={scrollQuestion ? event => setTaskHeight(event.nativeEvent.layout.height) : undefined}>
            <ModelStage layout={pictureInCard || puzzle.type === 'fraction_number_line' ? undefined : { ...stageLayout,
              intrinsicWidth: !puzzle.response && kind === 'fraction_build' ? 240 : !puzzle.response && kind === 'fraction_match' ? 312 : undefined }}>
            <CheckedDrawingTransition key={puzzle.id} viewport={proofViewport} checked={carriesEditorDrawing && replacingDrawing}
              preparing={retainingOuterEditor}>
            {playback && !keepsResponse && (!placeValueMiss || kind === 'decimal_place_value') ? evidence :
            <PuzzleTaskView
              storyHostsAnswer={storyHostsAnswer}
              AnswerRow={playback ? NoAnswerRow : answerHost.Controls}
              playbackOwnsControls={!!playback}
              retainPracticeDrawing={retainPracticeDrawing && !retainingOuterEditor}
              checkedModel={checkedModel}
              checkedAttempt={playback ?? undefined}
              onSolutionShown={inlineModel && playback && (playback.correct || everydayModel?.kind === 'grid' || hasEverydayAttempt) ? markSolutionShown : undefined}
              initialChallengeAnswer={challengeAnswer}
              initialDistribution={distribution}
              onUseHelp={recordHelp}
              onDistributionChange={setDistribution}
              decimalCells={decimalCells}
              onDecimalSelectionChange={setDecimalCells}
              puzzle={puzzle}
              responseValue={playback ? playback.draft.response ?? null : responseValue}
              onResponseChange={value => {
                if (puzzle.response?.kind === 'write') {
                  if (lastAttempt) setEditingRetry(true);
                  if (!responseValue && value && fontScale >= 2 && largePromptBottom > scrollHeight * 0.4) {
                    taskScroll.current?.scrollTo({ y: largePromptBottom, animated: false });
                  }
                }
                setResponseValue(value);
              }}
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
              onChallengeAnswerChange={changeChallengeAnswer}
              onDragStateChange={setIsDraggingTile}
              selectedIndex={playback ? playback.draft.choice ?? null : pendingChoice}
              incorrectAttempt={showMistake && !largeRetryEditor}
              selectedOperators={selectedOperators}
              fractionPieces={fractionPieces}
              fractionSelectedSlices={fractionSelectedSlices}
              numberLineValue={pendingNumberLine}
              pairIndices={pairIndices}
              foundPairs={foundPairs}
              onFoundPairsChange={setFoundPairs}
              numberOrder={numberOrder}
              selectedByPair={playback?.draft.selectedByPair ?? selectedByPair}
              onToggleWedge={handleToggleWedge}
              answered={answered || !!playback}
              isCorrect={isCorrect}
              onSelectChoice={setPendingChoice}
              onSelectOperator={handleSelectOperator}
              onChangeFractionPieces={handleChangeFractionPieces}
              onToggleFractionSlice={handleToggleFractionSlice}
              onSelectNumberLineValue={setPendingNumberLine}
              onTogglePairIndex={handleTogglePairIndex}
              onPairChange={setPairIndices}
              onMoveOrder={handleMoveOrder}
              onSwapOrder={(from, to) => {
                if (answered) return;
                setNumberOrder(current => current.map((value, index) => index === from ? current[to] : index === to ? current[from] : value));
              }}
            />}
            </CheckedDrawingTransition>
            </ModelStage>
            </View>
          </View>
          </PlayProofCaptionContext.Provider>
          </ProofViewportContext.Provider>
          </RevealPlayContext.Provider>
          </QuantityPracticeProvider>
          </>}
          </PuzzleContentTransition>
          </ExchangeScrollContext.Provider>
          {scrollDenseProof && answerDock}
        </ScrollView>

        </View>

        {!scrollDenseProof && answerDock}

        {answered && !showingSolution ? (
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
            {...(preview && {
              continueLabel: t("developer.nextTopic"),
              onContinue: preview.onNext,
              secondaryLabel: t("developer.repeatPuzzle"),
              onGoHome: preview.onRepeat,
            })}
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

/** Room for answer pop and shake animations at the scroll edges (inside the 22 pt screen gutter). */
const SCROLL_BLEED = moderateScale(12);

const styles = StyleSheet.create({
  readAgain: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  mechanicIntro: {
    color: GameColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  detailIcon: { fontSize: 22, lineHeight: 26, fontWeight: "800", color: GameColors.text, textAlign: "center" },
  largeTypeSubmission: { fontSize: 16 },
  largeTypeResult: { paddingVertical: 4 },
  proofTools: { flexDirection: "row", alignItems: "center", gap: 4 },
  hostedPlayback: { flex: 1, minWidth: 0 },
  editingStage: { paddingBottom: 8 },
  proofStage: { flex: 1, minHeight: 0, overflow: "hidden" },
  compactDock: { gap: 4, paddingTop: 4, paddingBottom: 4 },
  // A soft round chip, never a bare "?" floating beside the replay pill.
  detailButton: { height: 44, width: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", backgroundColor: GameColors.selectedSurface },
  collapsedQuestion: { height: COLLAPSED_QUESTION_HEIGHT, flexDirection: "row", alignItems: "center", gap: 8 },
  collapsedQuestionText: { flex: 1, fontWeight: "800", fontSize: 18, color: GameColors.text },
  fullPrompt: { width: "100%", fontWeight: "800", fontSize: 16, color: GameColors.text },
  retainedDrawing: { ...StyleSheet.absoluteFill, zIndex: 1, overflow: "hidden", backgroundColor: GameColors.background },
  playbackControls: { minHeight: 48 },
  submission: { alignSelf: "stretch" },
  submittedChoice: { minHeight: 44, paddingVertical: 6 },
  answerDock: { flexShrink: 0, paddingTop: moderateScale(8), paddingBottom: moderateScale(8), gap: moderateScale(12), backgroundColor: GameColors.background },
  attemptFeedback: { flexDirection: "row", alignItems: "center", gap: moderateScale(8), padding: moderateScale(14), borderRadius: moderateScale(14), backgroundColor: GameColors.warningSurface },
  attemptCopy: { flex: 1, gap: moderateScale(3) },
  attemptTitle: { fontSize: moderateScale(15), fontWeight: "800", color: "#875100" },
  attemptHint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: GameColors.text },
  attemptHintOnly: { fontWeight: "700", textAlign: "center" },
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
  clockHeader: { gap: 4 },
  actionRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  actionButton: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  headerProgress: { flex: 1 },
  headerHelp: { width: 48, height: 48, flexShrink: 0, justifyContent: "center", alignItems: "center" },
  helpChip: { borderRadius: 24, backgroundColor: GameColors.selectedSurface },
  helpMark: { fontSize: 24, fontWeight: '700', color: GameColors.secondaryDark },
  // Icon-only so the progress rail gets the header's width; the label lives in accessibilityLabel.
  backBtn: {
    minWidth: 44,
    minHeight: moderateScale(48),
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backBtnDisabled: {
    opacity: 0.35,
  },
  // The scroll view clips to its frame, so it extends into the screen gutter and pads its
  // content back: a selected or checked answer can pop and shake without losing its edges.
  scroll: {
    flex: 1, minHeight: 0,
    backgroundColor: "transparent",
    marginHorizontal: -SCROLL_BLEED,
  },
  // Keep the heading and model anchored when the dock or proof changes height.
  // Dense boards: the content scrolls and keeps clear space above the dock.
  scrollFill: { flexGrow: 1, paddingHorizontal: SCROLL_BLEED },
  scrollContent: {
    flexGrow: 1,
    gap: moderateScale(8),
    paddingBottom: moderateScale(20),
  },
  boardContent: { paddingBottom: 0 },
  taskArea: {
    flexGrow: 1,
    alignSelf: "stretch",
  },
});
