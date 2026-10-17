import initialPrices from '@/data/store-prices.json';
import { LIFE_BUY_COST } from '@/constants/game';
import type { StorePrice } from '@/types/store';

export type StoreItemKind = keyof typeof initialPrices | 'life';
export type CatalogItem = {
  kind: StoreItemKind; item_id: string; base_price: number; sale_price: number | null;
  sale_starts_at: string | null; sale_ends_at: string | null; sale_label: string | null;
};
export type StoreSale = {
  kind: Exclude<StoreItemKind, 'life'>;
  itemIds: string[];
  minPercent: number;
  maxPercent: number;
  label: string | null;
  endsAt: string | null;
};
const listeners = new Set<() => void>();
let items = new Map<string, CatalogItem>();
let revision = 0;
let serverOffset = 0;

export function subscribeStoreCatalog(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getStoreCatalogRevision() { return revision; }
/** Shared by price eligibility and sale countdowns. */
export function getStoreServerTime(now = Date.now()) { return now + serverOffset; }
export function invalidateStoreCatalog() {
  revision++;
  listeners.forEach(listener => listener());
}

/** Validate the complete response before replacing the last usable snapshot. */
export function acceptStoreCatalog(value: unknown, receivedAt = Date.now()) {
  const snapshot = value as { server_time?: string; items?: CatalogItem[] } | null;
  const time = Date.parse(snapshot?.server_time ?? '');
  if (!Number.isFinite(time) || !Array.isArray(snapshot?.items) || !snapshot.items.length) throw new Error('Invalid store catalog');
  const next = new Map<string, CatalogItem>();
  for (const item of snapshot.items) {
    const price = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 2147483647;
    if (!item || !(Object.prototype.hasOwnProperty.call(initialPrices, item.kind) || item.kind === 'life') || typeof item.item_id !== 'string' || !item.item_id ||
        !price(item.base_price) || (item.sale_price !== null && (!price(item.sale_price) || item.sale_price > item.base_price)) ||
        [item.sale_starts_at, item.sale_ends_at].some(date => date !== null && (typeof date !== 'string' || !Number.isFinite(Date.parse(date)))) ||
        (item.sale_starts_at && item.sale_ends_at && Date.parse(item.sale_starts_at) >= Date.parse(item.sale_ends_at)) ||
        (item.sale_label !== null && typeof item.sale_label !== 'string')) throw new Error('Invalid store catalog item');
    const key = `${item.kind}:${item.item_id}`;
    if (next.has(key)) throw new Error('Duplicate store catalog item');
    next.set(key, { ...item });
  }
  items = next;
  serverOffset = time - receivedAt;
  invalidateStoreCatalog();
}

export function nextStoreCatalogTransition(now = Date.now()) {
  const serverNow = getStoreServerTime(now);
  let next = Infinity;
  for (const item of items.values()) for (const date of [item.sale_starts_at, item.sale_ends_at]) {
    if (item.sale_price === null || !date) continue;
    const time = Date.parse(date);
    if (time > serverNow) next = Math.min(next, time - serverOffset);
  }
  return next;
}

export function getStoreCoinPrice(kind: string, id: string, now = Date.now()): number | undefined {
  const remote = items.get(`${kind}:${id}`);
  if (remote) {
    const time = getStoreServerTime(now);
    const sale = remote.sale_price !== null && (!remote.sale_starts_at || time >= Date.parse(remote.sale_starts_at)) &&
      (!remote.sale_ends_at || time < Date.parse(remote.sale_ends_at));
    return sale ? remote.sale_price! : remote.base_price;
  }
  if (kind === 'life' && id === 'one') return LIFE_BUY_COST;
  return (initialPrices as Record<string, Record<string, number>>)[kind]?.[id];
}

/** Bundled prices are first-launch/offline display defaults, never debit authority. */
export function getCatalogStorePrice(kind: string, id: string, now = Date.now()): StorePrice {
  const amount = getStoreCoinPrice(kind, id, now);
  if (amount === undefined) return { kind: 'iap', productId: '' };
  const item = items.get(`${kind}:${id}`);
  const promotion = item && amount < item.base_price ? {
    originalAmount: item.base_price, promotion: item.sale_label || undefined,
    promotionEndsAt: item.sale_ends_at || undefined,
  } : {};
  return amount === 0 ? { kind: 'free', ...promotion } : { kind: 'coins', amount, ...promotion };
}

/** Campaigns stay separate so each advertised countdown matches its offers. */
export function getActiveStoreSales(now = Date.now()): StoreSale[] {
  const sales = new Map<string, StoreSale>();
  for (const item of items.values()) {
    if (item.kind === 'life' || !Object.prototype.hasOwnProperty.call(initialPrices[item.kind], item.item_id)) continue;
    const amount = getStoreCoinPrice(item.kind, item.item_id, now)!;
    if (amount >= item.base_price) continue;
    const percent = Math.floor((item.base_price - amount) * 100 / item.base_price);
    const key = JSON.stringify([item.kind, item.sale_label, item.sale_ends_at]);
    const sale = sales.get(key);
    if (sale) {
      sale.itemIds.push(item.item_id);
      sale.minPercent = Math.min(sale.minPercent, percent);
      sale.maxPercent = Math.max(sale.maxPercent, percent);
    } else {
      sales.set(key, { kind: item.kind, itemIds: [item.item_id], minPercent: percent, maxPercent: percent,
        label: item.sale_label, endsAt: item.sale_ends_at });
    }
  }
  return [...sales.values()].sort((a, b) => b.maxPercent - a.maxPercent || b.itemIds.length - a.itemIds.length);
}
