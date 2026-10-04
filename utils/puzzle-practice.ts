import type { Puzzle } from "@/types/puzzle";

/** Shuffle displayed choices without changing their meaning or the accepted answer. */
export function shufflePuzzleChoices(puzzle: Puzzle, seed: string): Puzzle {
  if (puzzle.type === "compare" || puzzle.type === "true_false" || !("correctIndex" in puzzle)) return puzzle;
  const choices = "choices" in puzzle ? puzzle.choices : "payload" in puzzle && "choices" in puzzle.payload ? puzzle.payload.choices : null;
  if (!choices) return puzzle;
  const indices = choices.map((_, index) => index);
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  for (let i = indices.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const ordered = indices.map(index => choices[index]);
  const correctIndex = indices.indexOf(puzzle.correctIndex);
  return ("choices" in puzzle ? { ...puzzle, choices: ordered, correctIndex }
    : { ...puzzle, payload: { ...puzzle.payload, choices: ordered }, correctIndex }) as Puzzle;
}
