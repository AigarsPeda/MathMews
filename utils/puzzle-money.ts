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
  const amount = cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100);
  return '€' + (locale === 'en' ? amount : amount.replace('.', ','));
}
