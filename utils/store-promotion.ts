import type { StorePrice } from '@/types/store';
import { getStoreServerTime } from '@/utils/store-catalog';

export const STORE_SALE_CATEGORIES = {
  room: { tab: 'rooms', label: 'store.tabRooms' },
  bed: { tab: 'beds', label: 'store.tabBeds' },
  toy: { tab: 'toys', label: 'store.tabToys' },
  decoration: { tab: 'living', label: 'store.tabDecorations' },
  skin: { tab: 'colors', label: 'store.tabColors' },
} as const;

/** Round down so the badge never promises more savings than the coin price. */
export function getStorePromotion(price: StorePrice, now = Date.now()) {
  if (price.kind === 'iap' || !price.originalAmount || !Number.isFinite(price.originalAmount)) return null;
  const amount = price.kind === 'free' ? 0 : price.amount;
  if (!Number.isFinite(amount) || amount < 0 || amount >= price.originalAmount) return null;
  const endsAt = price.promotionEndsAt ? Date.parse(price.promotionEndsAt) : NaN;
  const remainingMs = Number.isFinite(endsAt) ? endsAt - getStoreServerTime(now) : undefined;
  if (remainingMs !== undefined && remainingMs <= 0) return null;
  return {
    percent: Math.floor((price.originalAmount - amount) * 100 / price.originalAmount),
    remainingMs,
  };
}

/** Keep long sales compact; show seconds during the final hour. */
export function getSaleCountdown(remainingMs: number) {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  if (seconds >= 86400) return { key: 'days', days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600) };
  if (seconds >= 3600) return { key: 'hours', hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60) };
  if (seconds >= 60) return { key: 'minutes', minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
  return { key: 'seconds', seconds };
}
