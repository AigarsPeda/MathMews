import {
  PET_VIDEO_KEYS,
  PET_VIDEO_SOURCES,
  type PetVideoKey,
} from "@/constants/pet-videos";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
import { useMemo } from "react";

function setupPlayer(player: VideoPlayer) {
  player.muted = true;
  player.loop = false;
}

export type PetVideoPlayerPool = Record<PetVideoKey, VideoPlayer>;

/** One pre-buffered player per unique clip — enables flicker-free mood switches. */
export function usePetVideoPlayers(): PetVideoPlayerPool {
  const idle = useVideoPlayer(PET_VIDEO_SOURCES.idle, setupPlayer);
  const happy_bounce = useVideoPlayer(
    PET_VIDEO_SOURCES.happy_bounce,
    setupPlayer,
  );
  const happy_bounce2 = useVideoPlayer(
    PET_VIDEO_SOURCES.happy_bounce2,
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
      sad,
      sad2,
      idle,
      eating,
      correct,
      sleeping,
      victory_spin,
      happy_bounce,
      happy_bounce2,
      catches_a_coin,
    }),
    [
      sad,
      sad2,
      idle,
      eating,
      correct,
      sleeping,
      victory_spin,
      happy_bounce,
      happy_bounce2,
      catches_a_coin,
    ],
  );
}

export { PET_VIDEO_KEYS };
