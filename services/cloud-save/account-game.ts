import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletEnvironment } from '@/services/wallet/environment';
import type { GameSave } from '@/types/save';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';

const archiveKey = (userId: string, environment = getWalletEnvironment()) =>
  `@mathmews/account-game:${environment}:${userId}`;

export function gameAccountOwner(save: GameSave): string | undefined {
  return save.accountOwnerId ?? save.walletAuthority?.user_id;
}

/** Keep the old account's local game on this phone. Never merge its progress or
 * paid wallet into a different sign-in account. RLS still protects remote rows. */
export async function prepareAccountGame(userId: string, save: GameSave, saveId: string | null, clientUpdatedAt: number) {
  const owner = gameAccountOwner(save);
  if (!owner || owner === userId) return { save: { ...save, accountOwnerId: userId }, saveId, clientUpdatedAt };
  await AsyncStorage.setItem(archiveKey(owner), JSON.stringify({ save, saveId, clientUpdatedAt }));
  const raw = await AsyncStorage.getItem(archiveKey(userId));
  if (raw) {
    const archived = JSON.parse(raw);
    const parsed = parseGameSaveFromValue(archived.save);
    if (parsed && gameAccountOwner(parsed.save) === userId) {
      return { save: { ...parsed.save, accountOwnerId: userId },
        saveId: typeof archived.saveId === 'string' ? archived.saveId : null,
        clientUpdatedAt: typeof archived.clientUpdatedAt === 'number' && Number.isFinite(archived.clientUpdatedAt) ? archived.clientUpdatedAt : 0 };
    }
    throw new Error('Account game archive unavailable');
  }
  return { save: { ...createDefaultGameSave(), accountOwnerId: userId }, saveId: null, clientUpdatedAt: 0 };
}

export async function clearAccountGameArchives(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([archiveKey(userId, 'sandbox'), archiveKey(userId, 'production')]);
}
