import { formatPriceTicket, moneyPurchase, type MoneyModel } from '@/utils/puzzle-money';

/** Money proofs draw one tape, exactly one model width wide (grammar: docs 11-money-wave4). */
export const MONEY_MAX_WIDTH = 340;
export const MONEY_SEGMENT_MIN = 56;
export const MONEY_SEGMENT_GAP = 4;

export type TapeTone = 'teal' | 'violet' | 'amber';
export type TapeSegment = { value: number; label: string; tone: TapeTone };
export type TapePlan = {
  segments: TapeSegment[];
  /** What the whole tape adds up to; it labels the lane above the tape's right end. */
  extent: number;
  /** Value that is not drawn (the unspent part of a wallet). */
  unfilled: number;
};

/** The one width every money row shares. */
export function moneyWidth(available: number) {
  return Math.max(200, Math.min(MONEY_MAX_WIDTH, Math.floor(available - 32)));
}

/** Net price of each line, with any discount spread over the lines so they add up to the price. */
export function lineNets(model: MoneyModel) {
  const lines = model.prices.map((price, i) => price * model.quantities[i]);
  const total = lines.reduce((sum, v) => sum + v, 0);
  const { price } = moneyPurchase(model);
  if (!model.discount || total === price) return lines;
  let left = price;
  return lines.map((line, i) => {
    const net = i === lines.length - 1 ? left : line - Math.round(line * model.discount / 100);
    left -= net;
    return net;
  });
}

/** The first segment that crosses the boundary, and every one after it, becomes ONE amber segment. */
function markMiss(segments: TapeSegment[], boundary: number, label: string): TapeSegment[] {
  let reached = 0;
  const at = segments.findIndex(segment => (reached += segment.value) > boundary);
  if (at < 0) return segments;
  const rest = segments.slice(at).reduce((sum, segment) => sum + segment.value, 0);
  return [...segments.slice(0, at), { value: rest, label, tone: 'amber' }];
}

/** Split `count` equal items into at most `max` evenly sized groups of about five. */
export function itemGroups(count: number, per = 5, max = 6) {
  if (count <= 0) return [];
  const groups = Math.min(max, Math.ceil(count / per));
  return Array.from({ length: groups }, (_, i) => Math.floor(count / groups) + (i < count % groups ? 1 : 0))
    .sort((a, b) => b - a);
}

/**
 * The tape for every variant except the discount strip. `amount` is the child's submitted amount
 * (a count for "afford", a price otherwise). Without it the tape shows the true answer. A miss keeps
 * the same segments and adds ONE amber segment for the over- or under-part.
 */
export function planMoneyTape(model: MoneyModel, amount: number | undefined, locale: string): TapePlan {
  const money = (n: number) => formatPriceTicket(n, model.unit, locale);
  const { price, subtotal, itemCount, change } = moneyPurchase(model);
  const nets = lineNets(model);
  const goods: TapeSegment[] = nets.map(value => ({ value, label: money(value), tone: 'teal' }));
  const sign = (n: number) => (n > 0 ? '+' : '−') + money(Math.abs(n));

  if (model.task === 'total') {
    if (amount === undefined || amount === price) return { segments: goods, extent: price, unfilled: 0 };
    if (amount > price) return { segments: [...goods, { value: amount - price, label: sign(amount - price), tone: 'amber' }], extent: amount, unfilled: 0 };
    return { segments: markMiss(goods, amount, sign(amount - price)), extent: price, unfilled: 0 };
  }
  if (model.task === 'change') {
    const truth = change ?? 0;
    const spend = [...goods];
    if (amount === undefined || amount === truth) return { segments: [...spend, { value: truth, label: money(truth), tone: 'violet' }], extent: model.paid, unfilled: 0 };
    if (amount > truth) return { segments: [...spend, { value: truth, label: money(truth), tone: 'violet' },
      { value: amount - truth, label: sign(amount - truth), tone: 'amber' }], extent: model.paid + amount - truth, unfilled: 0 };
    return { segments: [...spend, ...(amount > 0 ? [{ value: amount, label: money(amount), tone: 'violet' as const }] : []),
      { value: truth - amount, label: sign(amount - truth), tone: 'amber' }], extent: model.paid, unfilled: 0 };
  }
  if (model.task === 'afford') {
    const each = model.prices[0];
    const fits = amount === undefined ? itemCount : Math.min(amount, itemCount);
    const groups: TapeSegment[] = itemGroups(fits).map(n => ({ value: n * each, label: `${n} × ${money(each)}`, tone: 'teal' }));
    const spent = fits * each;
    if (amount === undefined || amount === itemCount) return { segments: groups, extent: model.paid, unfilled: model.paid - spent };
    if (amount > itemCount) {
      const over = (amount - itemCount) * each;
      return { segments: [...groups, { value: over, label: sign(over), tone: 'amber' }], extent: spent + over, unfilled: 0 };
    }
    const short = (itemCount - amount) * each;
    return { segments: [...groups, { value: short, label: sign(-short), tone: 'amber' }], extent: model.paid, unfilled: model.paid - spent - short };
  }
  // unit: the pack is split into equal shares, one per item.
  const count = model.quantities[0];
  const share = amount ?? price;
  const shares: TapeSegment[] = share > 0 ? Array.from({ length: count }, () => ({ value: share, label: money(share), tone: 'teal' as const })) : [];
  const trial = share * count;
  if (amount === undefined || trial === subtotal) return { segments: shares, extent: subtotal, unfilled: Math.max(0, subtotal - trial) };
  if (trial < subtotal) return { segments: [...shares, { value: subtotal - trial, label: sign(trial - subtotal), tone: 'amber' }], extent: subtotal, unfilled: 0 };
  return { segments: markMiss(shares, subtotal, sign(trial - subtotal)), extent: trial, unfilled: 0 };
}

/** Pixel left/width for each segment: proportional to value, none narrower than the minimum, seams between. */
export function layoutTape(plan: Pick<TapePlan, 'segments' | 'unfilled'>, width: number, minimum = MONEY_SEGMENT_MIN, gap = MONEY_SEGMENT_GAP) {
  const { segments, unfilled } = plan;
  const n = segments.length;
  if (!n) return [];
  const room = width - gap * (n - 1);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) + Math.max(0, unfilled);
  const floor = Math.min(minimum, room / n);
  const sizes = segments.map(segment => room * segment.value / total);
  const locked = new Array<boolean>(n).fill(false);
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    const fixed = sizes.reduce((sum, size, i) => sum + (locked[i] ? size : 0), 0);
    const free = segments.reduce((sum, segment, i) => sum + (locked[i] ? 0 : segment.value), 0) + Math.max(0, unfilled);
    const space = room - fixed;
    segments.forEach((segment, i) => {
      if (locked[i]) return;
      const size = free ? space * segment.value / free : 0;
      sizes[i] = size;
      if (size < floor) { sizes[i] = floor; locked[i] = true; changed = true; }
    });
    if (!changed) break;
  }
  let left = 0;
  return sizes.map(size => {
    const place = { left, width: size };
    left += size + gap;
    return place;
  });
}

/** Tiles for the discount strip: the smallest whole count that makes the cut a whole number of tiles. */
export function saleTiles(percent: number) {
  const tiles = Array.from({ length: 100 }, (_, i) => i + 1).find(n => n * percent % 100 === 0) ?? 100;
  return { tiles, cut: tiles * percent / 100 };
}
