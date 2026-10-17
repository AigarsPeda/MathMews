export type ParentGateChallenge = { digits: number[]; answer: string };

/** A reading-and-sequencing task, separate from the arithmetic taught in play.
 * This is a parent interaction gate, not identity or age verification. */
export function createParentGateChallenge(): ParentGateChallenge {
  const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
  return { digits, answer: [...digits].reverse().join('') };
}
