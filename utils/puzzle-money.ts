import type { EverydayModel } from '@/types/everyday';

export type MoneyModel = Extract<EverydayModel, { kind: 'money' }>;

const denominations = [200, 100, 50, 20, 10, 5, 2, 1];

export function coinsFor(cents: number): number[] {
  const coins: number[] = [];
  for (const value of denominations) {
    const count = Math.floor(cents / value);
    for (let i = 0; i < count; i++) coins.push(value);
    cents -= value * count;
  }
  return coins;
}

/** All prices, payments and intermediate totals stay in integer cents. */
export function moneyPurchase(model: MoneyModel) {
  const { task, prices, quantities, paid, discount } = model;
  const itemCount = task === 'afford' ? Math.floor(paid / prices[0]) : quantities[0];
  const subtotal = task === 'unit' ? prices[0] : task === 'afford' ? itemCount * prices[0]
    : prices.reduce((sum, price, i) => sum + price * quantities[i], 0);
  const saving = Math.round(subtotal * discount / 100);
  const price = task === 'unit' ? Math.round(subtotal / quantities[0]) : subtotal - saving;
  const change = task === 'change' || task === 'afford' ? paid - price : null;
  const priceCoins = model.coins
    ? prices.flatMap((value, i) => Array<number>(quantities[i]).fill(value))
    : coinsFor(price);
  return { price, subtotal, saving, itemCount, change, priceCoins, changeCoins: coinsFor(change ?? 0) };
}

export function formatPuzzleMoney(cents: number, unit: MoneyModel['unit'], locale: string) {
  if (unit === 'cents') return `${cents} c`;
  const amount = (cents / 100).toFixed(2);
  return '€' + (locale === 'en' ? amount : amount.replace('.', ','));
}

/** Compact sticker prices keep the currency and omit zero cents. */
export function formatPriceTicket(cents: number, unit: MoneyModel['unit'], locale: string) {
  return unit === 'euros' && cents % 100 === 0 ? `€${cents / 100}` : formatPuzzleMoney(cents, unit, locale);
}

export type MoneyInput = {
  choices: readonly string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onClear?: () => void;
};

/** A purse holds cents, except when the question asks for a count of items. */
export function trialValue(model: MoneyModel, choice?: string) {
  if (!choice || !/^\d+(?:[.,]\d+)?$/.test(choice.trim())) return undefined;
  const scale = model.task !== 'afford' && model.unit === 'euros' ? 100 : 1;
  return Math.round(Number(choice.replace(',', '.')) * scale);
}

const drawerValues = [5000, 2000, 1000, 500, ...denominations];

/** Choose up to four real denominations that make every offered amount with few moves. */
export function purseDrawer(model: MoneyModel, amounts: readonly number[]) {
  if (model.task === 'afford') return [5, 1];
  const values = drawerValues.filter(n => n <= Math.max(...amounts));
  let best: number[] = [1];
  let cost = Infinity;
  function visit(coins: number[], start: number) {
    let taps = 0;
    for (const amount of amounts) {
      let left = amount;
      for (const value of coins) { taps += Math.floor(left / value); left %= value; }
      if (left) { taps = Infinity; break; }
    }
    // A fourth face earns its space only when it saves several taps.
    const score = taps + coins.length * amounts.length;
    if (score < cost) { best = coins; cost = score; }
    if (coins.length < 4) for (let i = start; i < values.length; i++) visit([...coins, values[i]], i + 1);
  }
  visit([], 0);
  return best.length ? best : [1];
}

/** Compare the submitted quantity against the givens without printing the unknown. */
export function comparePurse(model: MoneyModel, amount: number, locale: string) {
  const money = (n: number) => formatPriceTicket(n, model.unit, locale);
  const { price, subtotal } = moneyPurchase(model);
  const terms = model.prices.map((p,i) => model.quantities[i] === 1 ? money(p) : `${model.quantities[i]} × ${money(p)}`).join(' + ');
  if (model.task === 'afford') {
    const unit = model.prices[0];
    const tooFew = (amount + 1) * unit <= model.paid;
    const lhs = `${amount} × ${money(unit)}` + (tooFew ? ` + ${money(unit)}` : '');
    return { trial: (amount + (tooFew ? 1 : 0)) * unit, target: model.paid, caption: `${lhs} ${tooFew ? '≤' : '>'} ${money(model.paid)}` };
  }
  if (model.task === 'unit') {
    const trial = amount * model.quantities[0];
    const relation = trial < subtotal ? '<' : trial > subtotal ? '>' : '=';
    return { trial, target: subtotal, caption: `${model.quantities[0]} × ${money(amount)} = ${money(trial)} ${relation} ${money(subtotal)}` };
  }
  if (model.task === 'discount') return { trial: amount, target: price, caption: `${money(amount)} ≠ ${100-model.discount}% × ${money(subtotal)}` };
  if (model.task === 'change') return { trial: price + amount, target: model.paid, caption: `${money(price)} + ${money(amount)} ≠ ${money(model.paid)}` };
  return { trial: amount, target: price, caption: `${money(amount)} ≠ ${terms}` };
}
