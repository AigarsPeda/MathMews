import type { AppLocale } from "@/types/locale";
import type { Puzzle } from "@/types/puzzle";

type LocalizedValue<T> = T extends string
  ? T | Record<AppLocale, string>
  : T extends readonly (infer Item)[]
    ? LocalizedValue<Item>[]
    : T extends object
      ? { [Key in keyof T]: LocalizedValue<T[Key]> }
      : T;

/** Only display fields can vary by language. Answers and metadata stay shared. */
export type PuzzleDefinition = Puzzle extends infer P
  ? P extends Puzzle
    ? { [Key in keyof P]: Key extends "question" | "hint" | "explanation" | "choices" | "payload"
        ? LocalizedValue<P[Key]> : P[Key] }
    : never
  : never;

function resolveText(value: unknown, locale: AppLocale): unknown {
  if (Array.isArray(value)) return value.map(item => resolveText(item, locale));
  if (value && typeof value === "object") {
    if ("en" in value) {
      const text = (value as Record<AppLocale, string>)[locale];
      if (typeof text !== "string") throw new Error(`Missing ${locale} puzzle text`);
      return text;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveText(item, locale)]));
  }
  return value;
}

export function localizePuzzle(puzzle: PuzzleDefinition, locale: AppLocale): Puzzle {
  return resolveText(puzzle, locale) as Puzzle;
}
