import { GameColors } from "@/constants/game";
import type { PetVideoKey } from "@/constants/pet-videos";
import { getPetVideo } from "@/constants/pet-videos";
import {
  PET_VIDEO_KEYS,
  usePetVideoPlayers,
} from "@/hooks/use-pet-video-players";
import type { PetAnimationState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

const DEFAULT_SIZE = 200;

type PetVideoAvatarProps = {
  mood: PetAnimationState;
  size?: number;
  loop?: boolean;
  onAnimationComplete?: () => void;
  onPress?: () => void;
};

export function PetVideoAvatar({
  mood,
  size = moderateScale(DEFAULT_SIZE),
  loop = false,
  onAnimationComplete,
  onPress,
}: PetVideoAvatarProps) {
  const players = usePetVideoPlayers();
  const onCompleteRef = useRef(onAnimationComplete);
  const loopRef = useRef(loop);
  const moodRef = useRef(mood);
  const activeKeyRef = useRef<PetVideoKey>(getPetVideo(mood).videoKey);
  const [activeKey, setActiveKey] = useState<PetVideoKey>(activeKeyRef.current);
  const readyRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const shouldLoop = useCallback((config: ReturnType<typeof getPetVideo>) => {
    return loopRef.current || config.loop;
  }, []);

  const revealSubRef = useRef<{ remove: () => void } | null>(null);

  const revealLayer = useCallback(
    (nextKey: PetVideoKey, prevKey: PetVideoKey) => {
      if (prevKey !== nextKey) {
        players[prevKey].pause();
      }
      activeKeyRef.current = nextKey;
      setActiveKey(nextKey);
    },
    [players],
  );

  const applyMood = useCallback(
    (nextMood: PetAnimationState) => {
      const config = getPetVideo(nextMood);
      const nextKey = config.videoKey;
      const nextPlayer = players[nextKey];
      const prevKey = activeKeyRef.current;

      moodRef.current = nextMood;
      revealSubRef.current?.remove();
      revealSubRef.current = null;

      const startSec = (config.startMs ?? 0) / 1000;
      const looping = shouldLoop(config);
      const nativeLoop = looping && (config.startMs ?? 0) === 0;

      nextPlayer.loop = nativeLoop;
      nextPlayer.currentTime = startSec;
      nextPlayer.play();

      if (nextKey === prevKey) {
        revealLayer(nextKey, prevKey);
        return;
      }

      revealSubRef.current = nextPlayer.addListener(
        "playingChange",
        ({ isPlaying }) => {
          if (!isPlaying) return;
          revealSubRef.current?.remove();
          revealSubRef.current = null;
          revealLayer(nextKey, prevKey);
        },
      );
    },
    [players, revealLayer, shouldLoop],
  );

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
    }
    applyMood(mood);
  }, [applyMood, loop, mood]);

  useEffect(() => {
    const subscriptions = PET_VIDEO_KEYS.map((key) =>
      players[key].addListener("playToEnd", () => {
        if (activeKeyRef.current !== key) return;

        const config = getPetVideo(moodRef.current);
        const startSec = (config.startMs ?? 0) / 1000;

        if (shouldLoop(config)) {
          players[key].currentTime = startSec;
          players[key].play();
          return;
        }

        if (!config.loop) {
          queueMicrotask(() => onCompleteRef.current?.());
        }
      }),
    );

    return () => {
      revealSubRef.current?.remove();
      revealSubRef.current = null;
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [players, shouldLoop]);

  const content = (
    <View style={[styles.container, { width: size, height: size }]}>
      {PET_VIDEO_KEYS.map((key) => (
        <VideoView
          key={key}
          player={players[key]}
          style={[styles.videoLayer, { opacity: activeKey === key ? 1 : 0 }]}
          contentFit="contain"
          nativeControls={false}
          {...(Platform.OS === "android" ? { surfaceType: "textureView" } : {})}
        />
      ))}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GameColors.petVideoBg,
  },
});
