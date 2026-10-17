import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePendingWalletPurchases, type PendingWalletPurchase } from './offline-orders';

const writes = new Map<string, Promise<unknown>>();
export const walletOutboxKey = (scope: string) => `@mathmews/wallet-outbox:${scope}`;

export async function readWalletOutbox(scope: string) {
  const key = walletOutboxKey(scope);
  await writes.get(key)?.catch(() => undefined);
  const raw = await AsyncStorage.getItem(key);
  return normalizePendingWalletPurchases(raw ? JSON.parse(raw) : []);
}

/** Serialized read/modify/write prevents a background receipt dropping a new tap. */
export function updateWalletOutbox(scope: string, update: (orders: PendingWalletPurchase[]) => PendingWalletPurchase[]) {
  const key = walletOutboxKey(scope);
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const raw = await AsyncStorage.getItem(key);
    const orders = update(normalizePendingWalletPurchases(raw ? JSON.parse(raw) : []));
    if (orders.length) await AsyncStorage.setItem(key,JSON.stringify(orders));
    else await AsyncStorage.removeItem(key);
    return orders;
  });
  writes.set(key,next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => undefined);
  return next;
}
