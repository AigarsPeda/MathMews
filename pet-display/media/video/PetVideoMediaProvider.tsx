import {
  DOG_MOOD_VIDEO_ASSET_KEYS,
  DOG_VIDEO_PRIME_SEC,
  DOG_VIDEO_SOURCES,
  type DogVideoAssetKey,
} from "@/pet-display/registry/dog-video-registry";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

export const PET_VIDEO_ASSET_KEYS = Object.keys(
  DOG_VIDEO_SOURCES,
) as DogVideoAssetKey[];

export type PetVideoAssetKey = DogVideoAssetKey;

export type PetVideoPlayerPool = Record<PetVideoAssetKey, VideoPlayer>;

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
  const idle = useVideoPlayer(DOG_VIDEO_SOURCES.idle, setupPlayer);
  const happy_bounce = useVideoPlayer(
    DOG_VIDEO_SOURCES.happy_bounce,
    setupPlayer,
  );
  const victory_spin = useVideoPlayer(
    DOG_VIDEO_SOURCES.victory_spin,
    setupPlayer,
  );
  const sad = useVideoPlayer(DOG_VIDEO_SOURCES.sad, setupPlayer);
  const sad2 = useVideoPlayer(DOG_VIDEO_SOURCES.sad2, setupPlayer);
  const eating = useVideoPlayer(DOG_VIDEO_SOURCES.eating, setupPlayer);
  const correct = useVideoPlayer(DOG_VIDEO_SOURCES.correct, setupPlayer);
  const sleeping = useVideoPlayer(DOG_VIDEO_SOURCES.sleeping, setupPlayer);
  const catches_a_coin = useVideoPlayer(
    DOG_VIDEO_SOURCES.catches_a_coin,
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

export function PetVideoMediaProvider({ children }: { children: ReactNode }) {
  const players = usePetVideoPlayerPool();

  useEffect(() => {
    for (const key of DOG_MOOD_VIDEO_ASSET_KEYS) {
      primePlayer(players[key], DOG_VIDEO_PRIME_SEC[key]);
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
    throw new Error(
      "usePetVideoPlayers must be used within PetDisplayProvider",
    );
  }
  return players;
}

/** Mood clips kept mounted on the home pet — excludes one-shot reaction videos. */
export const PET_MOOD_VIDEO_ASSET_KEYS = DOG_MOOD_VIDEO_ASSET_KEYS;
