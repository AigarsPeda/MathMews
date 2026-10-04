import {
  DOG_MOOD_VIDEO_ASSET_KEYS,
  DOG_VIDEO_SOURCES,
  type DogVideoAssetKey,
} from "@/pet-display/registry/dog-video-registry";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import {
  createContext,
  useContext,
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

function usePetVideoPlayerPool(): PetVideoPlayerPool {
  const idle = useVideoPlayer(null, setupPlayer);
  const happy_bounce = useVideoPlayer(null,
    setupPlayer,
  );
  const victory_spin = useVideoPlayer(null,
    setupPlayer,
  );
  const sad = useVideoPlayer(null, setupPlayer);
  const sad2 = useVideoPlayer(null, setupPlayer);
  const eating = useVideoPlayer(null, setupPlayer);
  const correct = useVideoPlayer(null, setupPlayer);
  const sleeping = useVideoPlayer(null, setupPlayer);
  const catches_a_coin = useVideoPlayer(null,
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
