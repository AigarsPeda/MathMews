import {
  isCloudSaveAvailable,
  listRemoteSaveSnapshots,
  pullRemoteSave,
  pushRemoteSave,
} from "@/services/cloud-save/cloud-save";
import {
  pickNewerSave,
  shouldUploadLocal,
  type CloudSaveSummary,
} from "@/services/cloud-save/merge-game-save";
import { listRestorableCloudSaves } from "@/services/cloud-save/restorable-cloud-save";
import type { GameSave } from "@/types/save";
import { getLocalSaveUpdatedAt, saveGameSave } from "@/utils/game-storage";
import { createSaveId, getActiveSaveId, setActiveSaveId } from "@/utils/save-id";
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
  activeSaveIdRef: MutableRefObject<string | null>;
  cloudSyncRef?: MutableRefObject<(() => Promise<void>) | null>;
  onRestorableCloudSaves?: (saves: CloudSaveSummary[]) => void;
  onInitialCloudCheckComplete?: () => void;
  blockCloudPushRef?: MutableRefObject<boolean>;
};

export function useCloudSaveSync({
  isGameReady,
  isAuthReady,
  userId,
  save,
  setSave,
  skipNextPersist,
  activeSaveIdRef,
  cloudSyncRef,
  onRestorableCloudSaves,
  onInitialCloudCheckComplete,
  blockCloudPushRef,
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

    const saveId = activeSaveIdRef.current ?? (await getActiveSaveId());
    if (!saveId) return;

    if (
      blockCloudPushRef?.current &&
      !saveRef.current.hasCompletedOnboarding
    ) {
      return;
    }

    const clientUpdatedAt = await getLocalSaveUpdatedAt();
    await pushRemoteSave(userId, saveId, {
      save: saveRef.current,
      clientUpdatedAt: clientUpdatedAt || Date.now(),
    });
  }, [activeSaveIdRef, blockCloudPushRef, userId]);

  useEffect(() => {
    if (!cloudSyncRef) return;
    cloudSyncRef.current = flushPush;
    return () => {
      cloudSyncRef.current = null;
    };
  }, [cloudSyncRef, flushPush]);

  useEffect(() => {
    if (!isGameReady || !isAuthReady) {
      return;
    }

    if (!userId || !isCloudSaveAvailable()) {
      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        onInitialCloudCheckComplete?.();
      }
      return;
    }

    if (initialSyncDone.current) return;

    let active = true;
    initialSyncDone.current = true;

    (async () => {
      const clientUpdatedAt = await getLocalSaveUpdatedAt();
      const local = {
        save: saveRef.current,
        clientUpdatedAt,
      };

      let saveId = activeSaveIdRef.current ?? (await getActiveSaveId());

      if (!saveId) {
        const remotes = await listRemoteSaveSnapshots(userId);
        if (!active) return;

        const restorable = listRestorableCloudSaves(local, remotes, null);
        if (restorable.length > 0) {
          onRestorableCloudSaves?.(restorable);
          onInitialCloudCheckComplete?.();
          return;
        }

        saveId = createSaveId();
        await setActiveSaveId(saveId);
        activeSaveIdRef.current = saveId;
        onInitialCloudCheckComplete?.();
        return;
      }

      activeSaveIdRef.current = saveId;

      const remote = await pullRemoteSave(userId, saveId);
      if (!active) return;

      const merged = pickNewerSave(local, remote);
      const shouldUpload = shouldUploadLocal(local, remote);

      if (merged !== saveRef.current) {
        skipNextPersist.current = false;
        setSave(merged);
        await saveGameSave(merged);
      }

      if (shouldUpload) {
        await pushRemoteSave(userId, saveId, {
          save: merged,
          clientUpdatedAt: (await getLocalSaveUpdatedAt()) || Date.now(),
        });
      }

      onInitialCloudCheckComplete?.();
    })().catch(() => {
      onInitialCloudCheckComplete?.();
    });

    return () => {
      active = false;
    };
  }, [
    activeSaveIdRef,
    isAuthReady,
    isGameReady,
    onInitialCloudCheckComplete,
    onRestorableCloudSaves,
    setSave,
    skipNextPersist,
    userId,
  ]);

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
