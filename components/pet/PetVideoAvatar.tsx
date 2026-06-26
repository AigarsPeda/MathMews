import { GameColors } from "@/constants/game";
import { PET_MOOD_VIDEO_KEYS, type PetVideoKey } from "@/constants/pet-videos";
import {
  PET_VIDEO_KEYS,
  usePetVideoPlayers,
} from "@/contexts/PetVideoProvider";
import type { PetVideoSegment } from "@/types/pet-animation";
import { moderateScale } from "@/utils/scale";
import { VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

const DEFAULT_SIZE = 200;
const SEGMENT_POLL_MS = 80;
const REVERSE_POLL_MS = 33;
const REVERSE_STEP_SEC = REVERSE_POLL_MS / 1000;
const SEEK_EPSILON_SEC = 0.04;

type PetVideoAvatarProps = {
  segment?: PetVideoSegment;
  scenarioSteps?: PetVideoSegment[];
  size?: number;
  loop?: boolean;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
  onPress?: () => void;
};

type LayerStack = {
  under: PetVideoKey | null;
  top: PetVideoKey;
};

function segmentToken(steps: PetVideoSegment[]) {
  return steps
    .map(
      (step, index) =>
        `${step.videoKey}:${step.startMs ?? 0}:${step.endMs ?? "end"}:${step.reverse ? "rev" : "fwd"}:${step.loop ? "loop" : "once"}:${index}`,
    )
    .join("|");
}

export function PetVideoAvatar({
  segment,
  scenarioSteps,
  size = moderateScale(DEFAULT_SIZE),
  loop = false,
  onAnimationComplete,
  onStepComplete,
  onPress,
}: PetVideoAvatarProps) {
  const players = usePetVideoPlayers();
  const onCompleteRef = useRef(onAnimationComplete);
  const onStepCompleteRef = useRef(onStepComplete);
  const loopRef = useRef(loop);
  const applySegmentRef = useRef<
    (config: PetVideoSegment, stepIndex: number) => void
  >(() => {});

  const initialKey =
    scenarioSteps?.[0]?.videoKey ?? segment?.videoKey ?? "idle";
  const activeKeyRef = useRef<PetVideoKey>(initialKey);
  const [layers, setLayers] = useState<LayerStack>({
    under: null,
    top: initialKey,
  });
  const [topVisible, setTopVisible] = useState(true);

  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIndexRef = useRef(0);
  const stepsRef = useRef<PetVideoSegment[]>([]);
  const playbackTokenRef = useRef("");
  const pendingRevealRef = useRef<{
    topKey: PetVideoKey;
    underKey: PetVideoKey | null;
    stepIndex: number;
    config: PetVideoSegment;
  } | null>(null);
  const revealFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearUnderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    onStepCompleteRef.current = onStepComplete;
  }, [onStepComplete]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const clearRevealFallback = useCallback(() => {
    if (revealFallbackRef.current) {
      clearTimeout(revealFallbackRef.current);
      revealFallbackRef.current = null;
    }
  }, []);

  const clearUnderTimer = useCallback(() => {
    if (clearUnderTimerRef.current) {
      clearTimeout(clearUnderTimerRef.current);
      clearUnderTimerRef.current = null;
    }
  }, []);

  const shouldLoop = useCallback((config: PetVideoSegment) => {
    return loopRef.current || config.loop === true;
  }, []);

  const seekIfNeeded = useCallback(
    (player: (typeof players)[PetVideoKey], targetSec: number) => {
      if (Math.abs(player.currentTime - targetSec) > SEEK_EPSILON_SEC) {
        player.currentTime = targetSec;
      }
    },
    [],
  );

  const finishStep = useCallback((stepIndex: number) => {
    queueMicrotask(() => onStepCompleteRef.current?.(stepIndex));

    const steps = stepsRef.current;
    const nextIndex = stepIndex + 1;
    if (nextIndex < steps.length) {
      stepIndexRef.current = nextIndex;
      applySegmentRef.current(steps[nextIndex], nextIndex);
      return;
    }

    queueMicrotask(() => onCompleteRef.current?.());
  }, []);

  const commitReveal = useCallback(
    (topKey: PetVideoKey, underKey: PetVideoKey | null) => {
      activeKeyRef.current = topKey;
      if (underKey) {
        players[underKey].pause();
      }
      clearUnderTimer();
      clearUnderTimerRef.current = setTimeout(() => {
        setLayers((current) =>
          current.top === topKey ? { under: null, top: topKey } : current,
        );
      }, 100);
    },
    [clearUnderTimer, players],
  );

  const watchSegmentEndForward = useCallback(
    (
      player: (typeof players)[PetVideoKey],
      config: PetVideoSegment,
      stepIndex: number,
    ) => {
      clearSegmentTimer();
      const startSec = (config.startMs ?? 0) / 1000;
      const looping = shouldLoop(config);

      if (config.endMs === undefined) {
        if (!looping) return;

        segmentTimerRef.current = setInterval(() => {
          if (activeKeyRef.current !== config.videoKey) return;

          const duration = player.duration;
          if (!Number.isFinite(duration) || duration <= startSec) return;
          if (player.currentTime < duration - 0.08) return;

          seekIfNeeded(player, startSec);
          player.play();
        }, SEGMENT_POLL_MS);
        return;
      }

      const endSec = config.endMs / 1000;

      segmentTimerRef.current = setInterval(() => {
        if (activeKeyRef.current !== config.videoKey) return;
        if (player.currentTime < endSec - 0.05) return;

        if (looping) {
          seekIfNeeded(player, startSec);
          player.play();
          return;
        }

        player.pause();
        player.playbackRate = 1;
        clearSegmentTimer();
        finishStep(stepIndex);
      }, SEGMENT_POLL_MS);
    },
    [clearSegmentTimer, finishStep, seekIfNeeded, shouldLoop],
  );

  const watchSegmentEndReverse = useCallback(
    (
      player: (typeof players)[PetVideoKey],
      config: PetVideoSegment,
      stepIndex: number,
    ) => {
      clearSegmentTimer();
      const startSec = (config.startMs ?? 0) / 1000;
      const endSec = config.endMs! / 1000;

      player.loop = false;
      player.playbackRate = 1;
      player.pause();
      player.currentTime = endSec;

      let reverseTime = endSec;

      segmentTimerRef.current = setInterval(() => {
        if (activeKeyRef.current !== config.videoKey) return;

        reverseTime -= REVERSE_STEP_SEC;
        if (reverseTime <= startSec) {
          player.currentTime = startSec;
          player.pause();
          clearSegmentTimer();
          finishStep(stepIndex);
          return;
        }

        player.currentTime = reverseTime;
      }, REVERSE_POLL_MS);
    },
    [clearSegmentTimer, finishStep],
  );

  const watchSegmentEnd = useCallback(
    (
      player: (typeof players)[PetVideoKey],
      config: PetVideoSegment,
      stepIndex: number,
    ) => {
      if (config.reverse) {
        watchSegmentEndReverse(player, config, stepIndex);
        return;
      }
      watchSegmentEndForward(player, config, stepIndex);
    },
    [watchSegmentEndForward, watchSegmentEndReverse],
  );

  const handleFirstFrame = useCallback(
    (key: PetVideoKey) => {
      const pending = pendingRevealRef.current;
      if (!pending || pending.topKey !== key) return;

      pendingRevealRef.current = null;
      clearRevealFallback();
      setTopVisible(true);
      watchSegmentEnd(players[key], pending.config, pending.stepIndex);
      commitReveal(key, pending.underKey);
    },
    [clearRevealFallback, commitReveal, players, watchSegmentEnd],
  );

  const queueRevealFallback = useCallback(
    (topKey: PetVideoKey) => {
      clearRevealFallback();
      revealFallbackRef.current = setTimeout(() => {
        handleFirstFrame(topKey);
      }, 350);
    },
    [clearRevealFallback, handleFirstFrame],
  );

  const applySegment = useCallback(
    (config: PetVideoSegment, stepIndex: number) => {
      const nextKey = config.videoKey;
      const nextPlayer = players[nextKey];
      const prevKey = activeKeyRef.current;

      clearSegmentTimer();
      clearUnderTimer();
      clearRevealFallback();
      pendingRevealRef.current = null;

      for (const key of PET_VIDEO_KEYS) {
        if (key !== nextKey) {
          players[key].pause();
        }
      }

      const startSec = (config.startMs ?? 0) / 1000;
      const endSec =
        config.endMs !== undefined ? config.endMs / 1000 : undefined;
      const looping = shouldLoop(config);
      const nativeLoop =
        !config.reverse &&
        looping &&
        (config.startMs ?? 0) === 0 &&
        config.endMs === undefined;

      nextPlayer.playbackRate = 1;
      nextPlayer.loop = nativeLoop;

      if (config.reverse && endSec !== undefined) {
        setLayers({ under: null, top: nextKey });
        setTopVisible(true);
        nextPlayer.currentTime = endSec;
        watchSegmentEnd(nextPlayer, config, stepIndex);
        activeKeyRef.current = nextKey;
        return;
      }

      const startPlayback = () => {
        seekIfNeeded(nextPlayer, startSec);
        nextPlayer.play();
      };

      if (nextKey === prevKey) {
        setLayers({ under: null, top: nextKey });
        setTopVisible(true);
        startPlayback();
        watchSegmentEnd(nextPlayer, config, stepIndex);
        activeKeyRef.current = nextKey;
        return;
      }

      players[prevKey].pause();

      if (looping && !config.reverse) {
        pendingRevealRef.current = {
          topKey: nextKey,
          underKey: null,
          stepIndex,
          config,
        };
        setLayers({ under: null, top: nextKey });
        setTopVisible(true);
        startPlayback();
        watchSegmentEnd(nextPlayer, config, stepIndex);
        activeKeyRef.current = nextKey;
        queueRevealFallback(nextKey);
        return;
      }

      setLayers({ under: prevKey, top: nextKey });
      setTopVisible(false);
      pendingRevealRef.current = {
        topKey: nextKey,
        underKey: prevKey,
        stepIndex,
        config,
      };
      startPlayback();
      queueRevealFallback(nextKey);
    },
    [
      clearRevealFallback,
      clearSegmentTimer,
      clearUnderTimer,
      players,
      queueRevealFallback,
      seekIfNeeded,
      shouldLoop,
      watchSegmentEnd,
    ],
  );

  applySegmentRef.current = applySegment;

  useEffect(() => {
    const steps = scenarioSteps ?? (segment ? [segment] : []);
    const token = segmentToken(steps);

    if (steps.length === 0) return;
    if (token === playbackTokenRef.current) return;

    playbackTokenRef.current = token;
    stepsRef.current = steps;
    stepIndexRef.current = 0;
    applySegment(steps[0], 0);
  }, [applySegment, scenarioSteps, segment]);

  useEffect(() => {
    const subscriptions = PET_VIDEO_KEYS.map((key) =>
      players[key].addListener("playToEnd", () => {
        if (activeKeyRef.current !== key) return;

        const steps = stepsRef.current;
        const stepIndex = stepIndexRef.current;
        const config = steps[stepIndex];
        if (!config || config.endMs !== undefined || config.reverse) return;

        const startSec = (config.startMs ?? 0) / 1000;

        if (shouldLoop(config)) {
          seekIfNeeded(players[key], startSec);
          players[key].play();
          return;
        }

        if (!config.loop) {
          finishStep(stepIndex);
        }
      }),
    );

    return () => {
      clearSegmentTimer();
      clearUnderTimer();
      clearRevealFallback();
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [
    clearRevealFallback,
    clearSegmentTimer,
    clearUnderTimer,
    finishStep,
    players,
    seekIfNeeded,
    shouldLoop,
  ]);

  const mountedVideoKeys = useMemo(() => {
    const keys = new Set<PetVideoKey>(PET_MOOD_VIDEO_KEYS);
    keys.add(layers.top);
    if (layers.under) {
      keys.add(layers.under);
    }
    return PET_VIDEO_KEYS.filter((key) => keys.has(key));
  }, [layers.top, layers.under]);

  const content = (
    <View style={[styles.container, { width: size, height: size }]}>
      {mountedVideoKeys.map((key) => {
        const isTop = key === layers.top;
        const isUnder = key === layers.under;
        const opacity =
          isTop && topVisible ? 1 : isUnder && !topVisible ? 1 : 0;

        return (
          <VideoView
            key={key}
            player={players[key]}
            style={[
              styles.videoLayer,
              {
                zIndex: isTop ? 2 : isUnder ? 1 : 0,
                opacity,
              },
            ]}
            contentFit="contain"
            nativeControls={false}
            useExoShutter={false}
            onFirstFrameRender={
              isTop ? () => handleFirstFrame(key) : undefined
            }
            {...(Platform.OS === "android"
              ? { surfaceType: "textureView" as const }
              : {})}
          />
        );
      })}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityLabel="Pet your companion"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: GameColors.petVideoBg,
    borderRadius: moderateScale(12),
  },
  videoLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GameColors.petVideoBg,
  },
});
