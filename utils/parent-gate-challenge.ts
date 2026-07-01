export type ParentGateChallenge = {
  a: number;
  b: number;
  answer: number;
  choices: number[];
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDistractors(answer: number, count = 2): number[] {
  const offsets = [-3, -2, -1, 1, 2, 3, 4, -4];
  const distractors: number[] = [];

  for (const offset of shuffle(offsets)) {
    const candidate = answer + offset;
    if (candidate <= 0 || candidate === answer) continue;
    if (distractors.includes(candidate)) continue;
    distractors.push(candidate);
    if (distractors.length === count) break;
  }

  while (distractors.length < count) {
    const candidate = answer + randomInt(-5, 5);
    if (candidate <= 0 || candidate === answer || distractors.includes(candidate)) {
      continue;
    }
    distractors.push(candidate);
  }

  return distractors;
}

/** Adult-oriented addition problem — harder than in-game easy puzzles. */
export function createParentGateChallenge(): ParentGateChallenge {
  const a = randomInt(7, 15);
  const b = randomInt(4, 12);
  const answer = a + b;

  return {
    a,
    b,
    answer,
    choices: shuffle([answer, ...buildDistractors(answer)]),
  };
}
