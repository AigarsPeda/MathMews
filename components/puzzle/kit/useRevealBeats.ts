/**
 * One clock for every solution reveal. A reveal is a list of beats; each beat
 * is one conceptual move (a group joins, a hop lands, a layer fills) followed
 * by a short hold. Dense reveals can retain each landing under Reduce Motion.
 * The learner can pause, resume, skip and replay.
 */
import { RevealPlayContext } from './RevealPlayContext';
import { createProofAnnouncer } from './proofAnnouncements';
import { Motion, ProofMotion } from '@/constants/puzzle-theme';
import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, ReduceMotion, runOnJS, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

/** Default: a move that lands (ease-out). */
export const RevealEasing = Easing.out(Easing.cubic);
/** Long continuous sweeps (rotations, clock hands, pours): ease in and out. */
export const SweepEasing = Easing.inOut(Easing.cubic);

export type RevealBeats = {
  /** Number of beats that have fully landed (0 … count). */
  landed: number;
  count?: number;
  /** The proof is mounted and waiting for its model to be measured. */
  preparing?: boolean;
  /** Native-only surfaces acknowledge the committed starting view. Async renderers acknowledge their own drawing. */
  nativePaintPending?: boolean;
  onInitialModelPainted?: (runId: number) => void;
  skipped?: boolean;
  announce?: (message: string, delay?: number) => void;
  cancelAnnouncements?: () => void;
  /** Progress of the current beat, 0 → 1, for continuous drawing. */
  progress: SharedValue<number>;
  /** Continuous clock position, 0 → count: beat index plus progress within it. */
  position: SharedValue<number>;
  done: boolean;
  /**
   * True one hold after the last beat lands. Show the final equation only once
   * `settled`, so the answer never appears in the same frame as the last unit.
   */
  settled: boolean;
  /** Reduce Motion is on. Dense models draw static states from landed. */
  reduced: boolean;
  /** The learner paused the reveal. */
  paused: boolean;
  pause: () => void;
  resume: () => void;
  /** Advance a paused proof by one landing, or from its final inspection to the equation. */
  nextStep?: () => void;
  /** Jump straight to the end (tap-to-skip). */
  skip: () => void;
  /** Start again from the first beat. */
  replay: () => void;
  /** Increments on every replay; use as a React key to restart entering animations. */
  runId: number;
};

export function useRevealBeats(beatCount: number | null, { step = Motion.step, hold = Motion.hold, lead = ProofMotion.lead, awaitInitialPaint = false, easing = 'out', minTotal = Motion.minReveal, reducedSteps = false, onDone }: {
  step?: number | ((beat: number) => number); hold?: number | ((landedCount: number) => number); lead?: number;
  /** A Skia/async model will explicitly acknowledge its complete initial frame. */
  awaitInitialPaint?: boolean;
  /** 'inOut' for long sweeps and rotations. */
  easing?: 'out' | 'inOut';
  /** A reveal never runs shorter than this (ms) so it can be followed; short reveals are slowed. */
  minTotal?: number;
  /** Preserve each landing under Reduce Motion. Draw static states from landed. */
  reducedSteps?: boolean;
  onDone?: () => void;
} = {}): RevealBeats & { count: number; onInitialModelPainted: (runId: number) => void; announce: (message: string, delay?: number) => void; cancelAnnouncements: () => void } {
  // Null reserves playback while layout is pending. A real zero still represents an idle editor or an empty proof.
  const { attemptKey, onInitialModelPainted: notifyHost, onProofFrame } = useContext(RevealPlayContext);
  const count = beatCount ?? 0;
  const reduce = useReducedMotion();
  const [speech] = useState(createProofAnnouncer);
  const [attempt, setAttempt] = useState({ key: attemptKey, serial: 0, replay: 0 });
  const currentAttempt = attempt.key === attemptKey ? attempt : { key: attemptKey, serial: attempt.serial + 1, replay: 0 };
  if (attempt !== currentAttempt) setAttempt(currentAttempt);
  const run = currentAttempt.replay;
  const runKey = `${currentAttempt.serial}:${run}`;
  const key = `${runKey}:${beatCount}`;
  const [paintedKey, setPaintedKey] = useState<string | null>(null);
  const expectsPaint = awaitInitialPaint || (attemptKey !== undefined && (beatCount !== 0 || !!onDone));
  const waitingForPaint = expectsPaint && paintedKey !== key;
  const preparing = beatCount === null || waitingForPaint;
  const activePaint = useRef<string | null>(null);
  useLayoutEffect(() => {
    activePaint.current = key;
    return () => { activePaint.current = null; };
  }, [key]);
  const onInitialModelPainted = useCallback((runId: number) => {
    if (runId === run && activePaint.current === key && beatCount !== null) setPaintedKey(key);
  }, [run, beatCount, key]);
  // Only the current committed attempt can retire the host's frozen model.
  const notified = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (expectsPaint && !preparing && notified.current !== runKey) {
      notified.current = runKey;
      notifyHost?.(run);
      onProofFrame?.({ phase: 'ready', runId: run, landed: 0 });
    }
  }, [expectsPaint, preparing, runKey, notifyHost, onProofFrame, run]);
  const [clock, setClock] = useState({ key, landed: 0, settled: false });
  const [skippedKey, setSkippedKey] = useState<string | null>(null);
  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const instant = !preparing && ((reduce && !reducedSteps) || count === 0);
  const current = clock.key === key ? clock : { landed: 0, settled: false };
  const landed = instant ? count : current.landed;
  const settled = instant || current.settled;
  const paused = !instant && pausedKey === key && !settled;
  const progress = useSharedValue(instant ? 1 : 0);
  const position = useSharedValue(instant ? count : 0);
  const doneRef = useRef(onDone);
  const auditRef = useRef(expectsPaint ? onProofFrame : undefined);
  const stepRef = useRef(step);
  const holdRef = useRef(hold);
  const completed = useRef<string | null>(null);
  const control = useRef<{ pause(): void; resume(): void; nextStep(): void; skip(): void } | null>(null);
  useLayoutEffect(() => { auditRef.current = expectsPaint ? onProofFrame : undefined; doneRef.current = onDone; stepRef.current = step; holdRef.current = hold; });

  useLayoutEffect(() => {
    const complete = () => {
      if (completed.current === key) return;
      completed.current = key;
      auditRef.current?.({ phase: 'settled', runId: run, landed: count });
      doneRef.current?.();
    };
    if (preparing) { progress.set(0); position.set(0); return speech.cancel; }
    if (instant) { progress.set(1); position.set(count); complete(); return speech.cancel; }

    let beat = 0;
    let phase: 'wait' | 'move' | 'done' = 'wait';
    let halted = false;
    let generation = 0;
    let remaining = lead, deadline = 0;
    let timer: ReturnType<typeof setTimeout>;
    const curve = easing === 'inOut' ? SweepEasing : RevealEasing;
    const holdAfter = (n: number) => Math.max(0, typeof holdRef.current === 'function' ? holdRef.current(n) : holdRef.current);
    const durationOf = (b: number) => {
      if (reduce) return Motion.fade;
      const raw = stepRef.current;
      if (typeof raw === 'function') return raw(b);
      // Preserve the existing minimum for legacy numeric beats and holds.
      const total = count * raw + (typeof holdRef.current === 'number' ? (count - 1) * holdRef.current : 0);
      return total < minTotal ? raw * minTotal / Math.max(1, total) : raw;
    };
    function finish() {
      if (phase === 'done') return;
      phase = 'done';
      beat = count;
      progress.set(1); position.set(count);
      setClock({ key, landed: count, settled: true });
      complete();
    }
    function wait(ms: number) {
      phase = 'wait';
      remaining = ms;
      deadline = Date.now() + ms;
      timer = setTimeout(() => {
        if (halted || phase !== 'wait') return;
        if (beat === count) finish();
        else move(beat, durationOf(beat));
      }, ms);
    }
    function move(from: number, duration: number) {
      if (phase === 'wait' && beat === 0) auditRef.current?.({ phase: 'playing', runId: run, landed: beat });
      phase = 'move';
      const ticket = ++generation;
      const land = (finished?: boolean) => {
        if (!finished || halted || ticket !== generation) return;
        beat += 1;
        auditRef.current?.({ phase: 'landing', runId: run, landed: beat });
        setClock({ key, landed: beat, settled: false });
        wait(holdAfter(beat));
      };
      // Keep the unelapsed time when pausing an eased (nonlinear) move.
      remaining = duration;
      deadline = Date.now() + duration;
      const timing = { duration, easing: curve, reduceMotion: ReduceMotion.Never };
      progress.set(from - beat);
      progress.set(withTiming(1, timing));
      position.set(from);
      position.set(withTiming(beat + 1, timing, finished => { runOnJS(land)(finished); }));
    }
    function stop() {
      generation++;
      clearTimeout(timer);
      cancelAnimation(position); cancelAnimation(progress);
    }
    progress.set(0); position.set(0);
    control.current = {
      pause() {
        if (halted || phase === 'done') return;
        halted = true;
        auditRef.current?.({ phase: 'paused', runId: run, landed: beat });
        remaining = Math.max(0, deadline - Date.now());
        stop();
      },
      resume() {
        if (!halted || phase === 'done') return;
        halted = false;
        // Resuming during the lead still has to wait for the first movement.
        if (phase !== 'wait' || beat > 0) auditRef.current?.({ phase: 'playing', runId: run, landed: beat });
        if (phase === 'wait') wait(remaining);
        else move(position.get(), remaining);
      },
      nextStep() {
        if (!halted || phase === 'done') return;
        if (beat >= count) { finish(); return; }
        beat += 1;
        auditRef.current?.({ phase: 'landing', runId: run, landed: beat });
        position.set(beat); progress.set(1);
        phase = 'wait'; remaining = holdAfter(beat);
        setClock({ key, landed: beat, settled: false });
      },
      skip() { if (phase !== 'done') { auditRef.current?.({ phase: 'skipped', runId: run, landed: beat }); stop(); finish(); } },
    };
    wait(Math.min(lead, ProofMotion.maxLead));
    return () => { halted = true; stop(); speech.cancel(); control.current = null; };
  }, [count, preparing, instant, reduce, key, lead, easing, minTotal, progress, position, speech, expectsPaint, run]);

  const skip = useCallback(() => { setSkippedKey(key); speech.cancel(); setPausedKey(null); control.current?.skip(); }, [key, speech]);
  const pause = useCallback(() => { speech.cancel(); control.current?.pause(); setPausedKey(key); }, [key, speech]);
  const resume = useCallback(() => { setPausedKey(null); control.current?.resume(); }, []);
  const nextStep = useCallback(() => { speech.cancel(); control.current?.nextStep(); }, [speech]);
  const replay = useCallback(() => { speech.cancel(); setPausedKey(null); setAttempt(a => ({ ...a, replay: a.replay + 1 })); }, [speech]);

  return { landed, count, preparing, nativePaintPending: waitingForPaint && beatCount !== null && !awaitInitialPaint, onInitialModelPainted, skipped: key === skippedKey, announce: speech.announce, cancelAnnouncements: speech.cancel, progress, position, done: !preparing && (reducedSteps ? settled : landed >= count), settled, reduced: !!reduce, paused, pause, resume, nextStep: paused && !settled ? nextStep : undefined, skip, replay, runId: run };
}
