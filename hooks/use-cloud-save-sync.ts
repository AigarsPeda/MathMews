import {
  isCloudSaveAvailable,
  mergeWithRemoteSave,
  pushRemoteSave,
} from "@/services/cloud-save/cloud-save";
import type { GameSave } from "@/types/save";
import { getLocalSaveUpdatedAt, saveGameSave } from "@/utils/game-storage";
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { AppState } from "react-native";

const PUSH_DEBOUNCE_MS = 3_000;

type UseCloudSaveSyncOptions = {
  isGameReady: boolean;
  isAuthReady: boolean;
  userId: string | null;
  save: GameSave;
  setSave: Dispatch<SetStateAction<GameSave>>;
  skipNextPersist: MutableRefObject<boolean>;
  cloudSyncRef?: MutableRefObject<(() => Promise<void>) | null>;
};

export function useCloudSaveSync({
  isGameReady,
  isAuthReady,
  userId,
  save,
  setSave,
  skipNextPersist,
  cloudSyncRef,
}: UseCloudSaveSyncOptions): void {
  const initialSyncDone = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (userId !== lastSyncedUserId.current) {
      initialSyncDone.current = false;
      lastSyncedUserId.current = userId;
    }
  }, [userId]);

  const flushPush = useCallback(async () => {
    if (!userId || !isCloudSaveAvailable()) return;

    const clientUpdatedAt = await getLocalSaveUpdatedAt();
    await pushRemoteSave(userId, {
      save: saveRef.current,
      clientUpdatedAt: clientUpdatedAt || Date.now(),
    });
  }, [userId]);

  useEffect(() => {
    if (!cloudSyncRef) return;
    cloudSyncRef.current = flushPush;
    return () => {
      cloudSyncRef.current = null;
    };
  }, [cloudSyncRef, flushPush]);

  useEffect(() => {
    if (!isGameReady || !isAuthReady || !userId || !isCloudSaveAvailable()) {
      return;
    }
    if (initialSyncDone.current) return;

    let active = true;
    initialSyncDone.current = true;

    (async () => {
      const clientUpdatedAt = await getLocalSaveUpdatedAt();
      const { save: merged, shouldUpload } = await mergeWithRemoteSave({
        userId,
        local: {
          save: saveRef.current,
          clientUpdatedAt,
        },
      });

      if (!active) return;

      if (merged !== saveRef.current) {
        skipNextPersist.current = false;
        setSave(merged);
        await saveGameSave(merged);
      }

      if (shouldUpload) {
        await pushRemoteSave(userId, {
          save: merged,
          clientUpdatedAt: (await getLocalSaveUpdatedAt()) || Date.now(),
        });
      }
    })().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isAuthReady, isGameReady, setSave, skipNextPersist, userId]);

  useEffect(() => {
    if (!isGameReady || !isAuthReady || !userId || !isCloudSaveAvailable()) {
      return;
    }
    if (!initialSyncDone.current) return;

    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
    }

    pushTimer.current = setTimeout(() => {
      flushPush().catch(() => undefined);
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
      }
    };
  }, [flushPush, isAuthReady, isGameReady, save, userId]);

  useEffect(() => {
    if (!userId || !isCloudSaveAvailable()) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        flushPush().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [flushPush, userId]);
}
