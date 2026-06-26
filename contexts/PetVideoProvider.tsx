import { MOOD_ANIMATION } from "@/constants/game";
import {
  PET_MOOD_VIDEO_KEYS,
  PET_VIDEO_SOURCES,
  type PetVideoKey,
} from "@/constants/pet-videos";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

export const PET_VIDEO_KEYS = Object.keys(PET_VIDEO_SOURCES) as PetVideoKey[];

export type PetVideoPlayerPool = Record<PetVideoKey, VideoPlayer>;

/** Park position (seconds) so action clips decode before first use. */
const WARM_START_SEC: Record<PetVideoKey, number> = {
  idle: 0,
  happy_bounce: (MOOD_ANIMATION.excited.startMs ?? 0) / 1000,
  victory_spin: (MOOD_ANIMATION.dancing.startMs ?? 0) / 1000,
  eating: (MOOD_ANIMATION.eating.startMs ?? 0) / 1000,
  sad: 0,
  sad2: (MOOD_ANIMATION.angry.startMs ?? 0) / 1000,
  sleeping: (MOOD_ANIMATION.sleeping.startMs ?? 0) / 1000,
  correct: 5,
  catches_a_coin: 5,
};

const PetVideoContext = createContext<PetVideoPlayerPool | null>(null);

function setupPlayer(player: VideoPlayer) {
  player.muted = true;
  player.loop = false;
}

function primePlayer(player: VideoPlayer, startSec: number) {
  const run = () => {
    player.currentTime = startSec;
    player.pause();
  };

  if (player.status === "readyToPlay") {
    run();
    return;
  }

  const sub = player.addListener("statusChange", ({ status }) => {
    if (status !== "readyToPlay") return;
    sub.remove();
    run();
  });
}

function usePetVideoPlayerPool(): PetVideoPlayerPool {
  const idle = useVideoPlayer(PET_VIDEO_SOURCES.idle, setupPlayer);
  const happy_bounce = useVideoPlayer(
    PET_VIDEO_SOURCES.happy_bounce,
    setupPlayer,
  );
  const victory_spin = useVideoPlayer(
    PET_VIDEO_SOURCES.victory_spin,
    setupPlayer,
  );
  const sad = useVideoPlayer(PET_VIDEO_SOURCES.sad, setupPlayer);
  const sad2 = useVideoPlayer(PET_VIDEO_SOURCES.sad2, setupPlayer);
  const eating = useVideoPlayer(PET_VIDEO_SOURCES.eating, setupPlayer);
  const correct = useVideoPlayer(PET_VIDEO_SOURCES.correct, setupPlayer);
  const sleeping = useVideoPlayer(PET_VIDEO_SOURCES.sleeping, setupPlayer);
  const catches_a_coin = useVideoPlayer(
    PET_VIDEO_SOURCES.catches_a_coin,
    setupPlayer,
  );

  return useMemo(
    () => ({
      idle,
      happy_bounce,
      victory_spin,
      sad,
      sad2,
      eating,
      correct,
      sleeping,
      catches_a_coin,
    }),
    [
      idle,
      happy_bounce,
      victory_spin,
      sad,
      sad2,
      eating,
      correct,
      sleeping,
      catches_a_coin,
    ],
  );
}

export function PetVideoProvider({ children }: { children: ReactNode }) {
  const players = usePetVideoPlayerPool();

  useEffect(() => {
    for (const key of PET_MOOD_VIDEO_KEYS) {
      primePlayer(players[key], WARM_START_SEC[key]);
    }
  }, [players]);

  return (
    <PetVideoContext.Provider value={players}>
      {children}
    </PetVideoContext.Provider>
  );
}

export function usePetVideoPlayers(): PetVideoPlayerPool {
  const players = useContext(PetVideoContext);
  if (!players) {
    throw new Error("usePetVideoPlayers must be used within PetVideoProvider");
  }
  return players;
}
