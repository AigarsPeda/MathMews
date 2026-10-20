/* eslint-disable react-hooks/immutability -- Caller-owned MutableRefObjects coordinate save identity and cloud callbacks; writes occur only in effects and events. */
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
import { getLocalSaveUpdatedAt, restoreGameSaveSnapshot, saveGameSave } from "@/utils/game-storage";
import { clearActiveSaveId, createSaveId, getActiveSaveId, setActiveSaveId } from "@/utils/save-id";
import { prepareAccountGame } from '@/services/cloud-save/account-game';
import { useNetworkReconnect } from '@/hooks/use-network-reconnect';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { AppState } from "react-native";

const PUSH_DEBOUNCE_MS = 3_000;
const PUSH_RETRY_MS = 15_000;

type UseCloudSaveSyncOptions = {
  isGameReady: boolean;
  isAuthReady: boolean;
  userId: string | null;
  save: GameSave;
  getSave?: () => GameSave;
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
  getSave,
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
  const [syncAttempt, setSyncAttempt] = useState(0);
  const pendingPush = useRef(false);
  const pushRevision = useRef(0);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (userId !== lastSyncedUserId.current) {
      initialSyncDone.current = false;
      pendingPush.current = false;
      pushRevision.current++;
      lastSyncedUserId.current = userId;
    }
  }, [userId]);

  const flushPush = useCallback(async () => {
    if (!userId || !isCloudSaveAvailable() || !initialSyncDone.current) return;

    const saveId = activeSaveIdRef.current ?? (await getActiveSaveId());
    if (!saveId) return;

    if (
      blockCloudPushRef?.current &&
      !saveRef.current.hasCompletedOnboarding
    ) {
      return;
    }

    const snapshot = getSave?.() ?? saveRef.current;
    const revision = ++pushRevision.current;
    pendingPush.current = true;
    const clientUpdatedAt = await saveGameSave(snapshot);
    if (lastSyncedUserId.current !== userId || activeSaveIdRef.current !== saveId) return;
    const uploaded = await pushRemoteSave(userId, saveId, {
      save: snapshot,
      clientUpdatedAt: clientUpdatedAt || Date.now(),
    });
    if (!uploaded) throw new Error('Cloud save upload unavailable');
    if (lastSyncedUserId.current === userId && revision === pushRevision.current) pendingPush.current = false;
  }, [activeSaveIdRef, blockCloudPushRef, getSave, userId]);

  const reconnect = useCallback(() => {
    if (initialSyncDone.current) void flushPush().catch(() => undefined);
    else setSyncAttempt(value => value + 1);
  }, [flushPush]);
  useNetworkReconnect(reconnect, isGameReady && isAuthReady && !!userId && isCloudSaveAvailable());

  useEffect(() => {
    if (!isGameReady || !isAuthReady || !userId || !isCloudSaveAvailable()) return;
    const timer = setInterval(() => {
      if (pendingPush.current && AppState.currentState === 'active') void flushPush().catch(() => undefined);
    }, PUSH_RETRY_MS);
    return () => clearInterval(timer);
  }, [flushPush, isAuthReady, isGameReady, userId]);

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
    let retry: ReturnType<typeof setTimeout> | undefined;
    const complete = () => {
      if (!active) return;
      initialSyncDone.current = true;
      onInitialCloudCheckComplete?.();
    };

    (async () => {
      let saveId = activeSaveIdRef.current ?? (await getActiveSaveId());
      const prepared = await prepareAccountGame(userId, getSave?.() ?? saveRef.current, saveId, await getLocalSaveUpdatedAt());
      if (!active) return;
      const local = { save: prepared.save, clientUpdatedAt: prepared.clientUpdatedAt };
      saveId = prepared.saveId;
      if (saveId) await setActiveSaveId(saveId); else await clearActiveSaveId();
      if (!active) return;
      activeSaveIdRef.current = saveId;
      skipNextPersist.current = true;
      setSave(prepared.save);
      await restoreGameSaveSnapshot(prepared.save, prepared.clientUpdatedAt);
      if (!active) return;

      if (!saveId) {
        const remotes = await listRemoteSaveSnapshots(userId);
        if (!active) return;

        const restorable = listRestorableCloudSaves(local, remotes, null);
        if (restorable.length > 0) {
          onRestorableCloudSaves?.(restorable);
          complete();
          return;
        }

        saveId = createSaveId();
        await setActiveSaveId(saveId);
        activeSaveIdRef.current = saveId;
        complete();
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
        await saveGameSave(getSave?.() ?? merged);
      }

      if (shouldUpload) {
        const uploaded = await pushRemoteSave(userId, saveId, {
          save: merged,
          clientUpdatedAt: (await getLocalSaveUpdatedAt()) || Date.now(),
        });
        if (!uploaded) throw new Error('Initial cloud save upload unavailable');
      }

      complete();
    })().catch(() => {
      // Storage or ownership errors must not enable uploads of another account's game.
      if (!active) return;
      if (saveRef.current.accountOwnerId === userId) onInitialCloudCheckComplete?.();
      retry = setTimeout(() => setSyncAttempt(value => value + 1), 15_000);
    });

    return () => {
      active = false;
      if (retry) clearTimeout(retry);
    };
  }, [
    activeSaveIdRef,
    getSave,
    isAuthReady,
    isGameReady,
    onInitialCloudCheckComplete,
    onRestorableCloudSaves,
    setSave,
    skipNextPersist,
    userId,
    syncAttempt,
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
