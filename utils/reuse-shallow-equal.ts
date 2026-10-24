/** Retain immutable state branches when their immediate fields did not change.
 * Deliberately avoids traversing saves, catalogs or room layouts recursively. */
export function reuseShallowEqual<T extends object | undefined>(previous: T, next: T): T {
  if (previous === next || !previous || !next) return next;
  const before = previous as Record<string, unknown>, after = next as Record<string, unknown>;
  const keys = Object.keys(next);
  return keys.length === Object.keys(previous).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(previous, key) && Object.is(before[key], after[key]))
    ? previous : next;
}
