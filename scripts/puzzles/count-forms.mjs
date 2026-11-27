/** Choose the supplied case forms. A decimal can have its own adjective ending. */
export function ruForm(n, one, few, many, decimal = few) {
  const value = Math.abs(Number(String(n).replace(',', '.')));
  if (!Number.isInteger(value)) return decimal;
  if (value % 100 >= 11 && value % 100 <= 14) return many;
  if (value % 10 === 1) return one;
  return value % 10 >= 2 && value % 10 <= 4 ? few : many;
}

export function lvCount(n, singular, plural) {
  const value = Math.abs(Number(n));
  return value % 10 === 1 && value % 100 !== 11 ? singular : plural;
}
