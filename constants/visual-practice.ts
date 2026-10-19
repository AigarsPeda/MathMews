import type { PracticeToken, VisualKeyframe, VisualScene } from "@/types/visual-explanation";

const token = (id: string, label: string, x: number, y: number, extra: Partial<PracticeToken> = {}): PracticeToken =>
  ({ id, label, x, y, ...extra });
const tile = (id: string, label: string, x: number, y = 55, extra: Partial<PracticeToken> = {}) =>
  token(id, label, x, y, { shape: "tile", ...extra });
const plain = (id: string, label: string, x: number, y = 55, extra: Partial<PracticeToken> = {}) =>
  token(id, label, x, y, { shape: "plain", ...extra });
const board = (prompt: string, tokens: PracticeToken[], result?: string): VisualScene =>
  ({ kind: "practice", prompt, tokens, result });
function frames(key: string, scenes: VisualScene[]): VisualKeyframe[] {
  return scenes.map((scene, index) => ({ at: index / (scenes.length - 1), captionKey: `visualHelp.lessons.${key}.s${index}`, scene }));
}
function counters(count: number, emoji: string, position: (index: number) => [number, number], extra?: (index: number) => Partial<PracticeToken>) {
  return Array.from({ length: count }, (_, i) => {
    const [x, y] = position(i);
    return token(`item-${i}`, emoji, x, y, extra?.(i));
  });
}
const pile = (i: number): [number, number] => [60 + (i % 5) * 44, 36 + Math.floor(i / 5) * 44];
const row = (i: number): [number, number] => [40 + (i % 6) * 44, 36 + Math.floor(i / 6) * 44];
function takeAway(key: string, emoji: string, total: number, losses: [number, number], prompt: string, results: [string, string]) {
  return frames(key, [0, 1, 2].map(step => board(prompt,
    counters(total, emoji, i => {
      const left = total - (step === 0 ? 0 : losses[step - 1]);
      return i < left ? pile(i) : [320 + (i - left) * 36, 80];
    }, i => ({ visible: i < total - (step === 0 ? 0 : losses[step - 1]), scale: step === 2 ? 1.12 : 1 })),
    step ? results[step - 1] : undefined)));
}
function share(key: string, total: number, remainder: boolean) {
  const prompt = `${total} ÷ 2 = ?`;
  const shared = (i: number): [number, number] => i >= total - total % 2
    ? [150, 115] : [i % 2 === 0 ? 64 + (Math.floor(i / 2) % 2) * 36 : 208 + (Math.floor(i / 2) % 2) * 36, 50 + Math.floor(i / 4) * 36];
  const items = (step: number) => counters(total, "🍪", i => step === 0 ? row(i)
    : step === 1 ? i < 4 ? [i % 2 === 0 ? 64 : 208, 66 + Math.floor(i / 2) * 36] : [26 + (i - 4) * 54, 20]
    : shared(i), i => ({ tone: step > 0 && i >= total - total % 2 ? "primary" : "secondary" }));
  const friends = [token("friend-a", "👧", 82, 122), token("friend-b", "👦", 226, 122)];
  return frames(key, [board(prompt, [...items(0), ...friends]), board(prompt, [...items(1), ...friends]), board(prompt, [...items(2), ...friends], remainder ? "4 + 4 + 1" : "8 ÷ 2 = 4")]);
}
function parts(denominator: number, numerator: number, y = 52, prefix = "part", width = 240) {
  return Array.from({ length: denominator }, (_, i) => token(`${prefix}-${i}`, "", 150 - width / 2 + (i + .5) * width / denominator, y,
    { shape: "part", tone: i < numerator ? "secondary" : "muted", width: width / denominator - 2 }));
}
function working(key: string, prompt: string, steps: [string, string, string][], results: (string | undefined)[] = []) {
  return frames(key, steps.map(([input, operation, output], i) => {
    const chained = i === 2 && input === steps[1][2];
    return board(prompt, [
      tile("input", chained ? steps[1][0] : input, 42, chained ? 120 : 55, { visible: !chained }),
      plain("arrow-in", "→", 88), tile("operation", operation, 150, 55, { tone: "primary" }),
      plain("arrow-out", "→", 210),
      tile("output", chained ? input : output, chained ? 42 : 258, 55, { tone: output === "?" ? "muted" : "secondary" }),
      tile("next-output", output, 258, 55, { visible: chained, tone: "secondary" }),
    ], results[i]);
  }));
}
function numbers(values: string[], positions?: number[], tones?: PracticeToken["tone"][]) {
  return values.map((value, i) => tile(`number-${value}`, value, positions?.[i] ?? 52 + i * 96, 55, { tone: tones?.[i], arc: value === "8" ? 28 : -28 }));
}

// Every token has a stable identity across steps. Moving the same object shows
// joining, taking away, dealing, sorting and calculating instead of swapping slides.
// Separate examples for halves and tenths, using the same animated board as
// the existing quarter and fifth examples. No active puzzle data is read here.
function percentExample(key: string, percent: number, whole: number, groups: number, discount = false) {
  const part = whole / groups;
  return frames(key, [0, 1, 2].map(step => board(`${discount ? `${whole} − ` : ""}${percent}% × ${whole} = ?`,
    Array.from({ length: groups }, (_, i) => tile(`percent-part-${i}`, step === 0 ? "?" : String(part),
      groups === 2 ? 90 + i * 120 : 30 + (i % 5) * 60, groups === 2 ? 60 : 35 + Math.floor(i / 5) * 65,
      { width: 44, height: 44, tone: i === 0 && step > 0 ? "primary" : "secondary", visible: !discount || i !== 0 || step < 2 })),
    step === 2 ? (discount ? `${whole} − ${part} = ${whole-part}` : `${percent}% × ${whole} = ${part}`) : step === 1 ? `${whole} ÷ ${groups} = ${part}` : undefined)));
}

export const VISUAL_PRACTICE = {
  sort_buckets: frames("sort_buckets", [0, 1, 2].map(step => board("< 7     |     ≥ 7", [
    tile("small", "4", step ? 75 : 110, 60, { tone: step ? "primary" : "secondary" }),
    tile("large", "9", step === 2 ? 225 : 190, 60, { tone: step === 2 ? "primary" : "secondary" }),
  ], step === 2 ? "4 < 7; 9 ≥ 7" : undefined))),
  fraction_sort: frames("fraction_sort", [0, 1, 2].map(step => board("1/3     |     2/3", [
    tile("first", "2/6", step ? 75 : 110, 60, { tone: step ? "primary" : "secondary" }),
    tile("second", "4/6", step === 2 ? 225 : 190, 60, { tone: step === 2 ? "primary" : "secondary" }),
  ], step === 2 ? "2/6 = 1/3; 4/6 = 2/3" : undefined))),
  repair_pattern: frames("repair_pattern", [0, 1, 2].map(step => board("+2", [
    tile("a", "2", 42), tile("b", step ? "4" : "?", 114, 55, { tone: step ? "primary" : "muted" }),
    tile("c", "6", 186), tile("d", step === 2 ? "8" : "?", 258, 55, { tone: step === 2 ? "primary" : "muted" }),
  ], step === 2 ? "2, 4, 6, 8" : undefined))),
  route_grid: frames("route_grid", [0, 1, 2].map(step => board("4 → +2 → ×2", [
    tile("start", "4", 60, 35), tile("turn", "+2", 210, 35, { tone: step ? "primary" : "muted" }),
    tile("exit", "×2", 210, 110, { tone: step === 2 ? "primary" : "muted" }),
  ], step === 2 ? "6 × 2 = 12" : step === 1 ? "4 + 2 = 6" : undefined))),
  budget_plan: frames("budget_plan", [0, 1, 2].map(step => board("30 − ? = 10", [
    tile("item", step ? "20 − 5 = 15" : "20; −25%", 150, 35, { width: 210 }),
    tile("extra", "5", 150, 110, { tone: step === 2 ? "primary" : "secondary" }),
  ], step === 2 ? "30 − 15 − 5 = 10" : step === 1 ? "20 − 5 = 15" : undefined))),
  number_range: frames("number_range", [0, 1, 2].map(step => board("3 < ? < 8", [
    tile("low", "3", 50), tile("middle", step === 0 ? "?" : "6", 150, 55, { tone: step > 0 ? "primary" : "muted", scale: step === 2 ? 1.15 : 1 }), tile("high", "8", 250),
  ], step === 2 ? "3 < 6 < 8" : undefined))),
  fraction_of_set: frames("fraction_of_set", [0, 1, 2].map(step => board("3/4 × 12 = ?", [
    ...counters(12, "●", i => [42 + (i % 4) * 72, 26 + Math.floor(i / 4) * 36], i => ({ tone: step > 0 && i % 4 < 3 ? "primary" : "secondary", scale: step === 2 && i % 4 < 3 ? 1.15 : 1 })),
  ], step === 2 ? "3 × 3 = 9" : step === 1 ? "12 ÷ 4 = 3" : undefined))),
  percent_half: percentExample("percent_half", 50, 40, 2),
  percent_tenth: percentExample("percent_tenth", 10, 30, 10),
  percent_half_discount: percentExample("percent_half_discount", 50, 40, 2, true),
  percent_tenth_discount: percentExample("percent_tenth_discount", 10, 30, 10, true),
  percent_of: frames("percent_of", [0, 1, 2].map(step => board("25% × 20 = ?", [
    ...Array.from({ length: 4 }, (_, i) => tile(`quarter-${i}`, step === 0 ? "?" : "5", 42 + i * 72, 55, { tone: step > 0 && i === 0 ? "primary" : "secondary", scale: step === 2 && i === 0 ? 1.15 : 1 })),
  ], step === 2 ? "25% × 20 = 5" : step === 1 ? "20 ÷ 4 = 5" : undefined))),
  percent_fifth: frames("percent_fifth", [0, 1, 2].map(step => board("20% × 30 = ?", [
    ...Array.from({ length: 5 }, (_, i) => tile(`fifth-${i}`, step === 0 ? "?" : "6", 30 + i * 60, 55, { tone: step > 0 && i === 0 ? "primary" : "secondary", scale: step === 2 && i === 0 ? 1.15 : 1 })),
  ], step === 2 ? "20% × 30 = 6" : step === 1 ? "30 ÷ 5 = 6" : undefined))),
  percent_fifth_discount: frames("percent_fifth_discount", [0, 1, 2].map(step => board("30 − 20% × 30 = ?", [
    ...Array.from({ length: 5 }, (_, i) => tile(`fifth-${i}`, step === 0 ? "?" : "6", 30 + i * 60, 55, { tone: i === 0 && step > 0 ? "primary" : "secondary", visible: i !== 0 || step < 2 })),
  ], step === 2 ? "30 − 6 = 24" : step === 1 ? "30 ÷ 5 = 6" : undefined))),
  percent_discount: frames("percent_discount", [0, 1, 2].map(step => board("20 − 25% × 20 = ?", [
    ...Array.from({ length: 4 }, (_, i) => tile(`quarter-${i}`, step === 0 ? "?" : "5", 42 + i * 72, 55, { tone: i === 0 && step > 0 ? "primary" : "secondary", visible: i !== 0 || step < 2 })),
  ], step === 2 ? "20 − 5 = 15" : step === 1 ? "20 ÷ 4 = 5" : undefined))),
  all_pairs: frames("all_pairs", [0, 1, 2].map(step => board("? + ? = 8", [
    tile("two", "2", step > 0 ? 100 : 42, 35, { tone: step > 0 ? "primary" : "secondary" }), tile("six", "6", step > 0 ? 200 : 114, 35, { tone: step > 0 ? "primary" : "secondary" }),
    tile("three", "3", step === 2 ? 100 : 186, step === 2 ? 105 : 35), tile("five", "5", step === 2 ? 200 : 258, step === 2 ? 105 : 35),
    plain("plus-a", "+", 150, 35, { visible: step > 0 }), plain("plus-b", "+", 150, 105, { visible: step === 2 }),
  ], step === 2 ? "2 + 6 = 8; 3 + 5 = 8" : undefined))),

  subtraction: takeAway("subtraction", "🍎", 7, [2, 2], "7 − 2 = ?", ["7 − 2 = 5", "7 − 2 = 5"]),
  addition: frames("addition", [0, 1, 2].map(step => board("2 + 4 = ?", counters(6, "🎈", i => step === 0
    ? [i < 2 ? 48 + i * 40 : 178 + (i - 2) % 2 * 40, 34 + (i < 2 ? 0 : Math.floor((i - 2) / 2) * 42)]
    : [40 + i * 44, 55], i => ({ tone: step === 2 ? "secondary" : undefined, scale: step === 2 ? 1.12 : 1 })), step === 2 ? "2 + 4 = 6" : undefined))),
  multiplication: frames("multiplication", [0, 1, 2].map(step => board("3 × 3 = ?", counters(9, "🧸", i => [106 + i % 3 * 44, 24 + Math.floor(i / 3) * 42],
    i => ({ visible: i < (step + 1) * 3 })), step === 2 ? "3 + 3 + 3 = 9" : undefined))),
  division: share("division", 8, false),
  all_but: takeAway("all_but", "🐑", 6, [4, 4], "🐑 6 → ?", ["6 − 4 = 2", "2"]),
  odd_range: frames("odd_range", [
    board("4 < ? < 7", [tile("five", "5", 102), tile("six", "6", 198)]),
    board("4 < ? < 7", [tile("five", "5", 102, 24, { tone: "primary" }), tile("six", "6", 198, 24),
      ...counters(5, "●", i => [62 + i % 2 * 24, 70 + Math.floor(i / 2) * 24], i => ({ tone: i === 4 ? "primary" : "secondary" })),
      ...counters(6, "●", i => [202 + i % 2 * 24, 70 + Math.floor(i / 2) * 24]).map(t => ({ ...t, id: `six-${t.id}` }))]),
    board("4 < ? < 7", [tile("five", "5", 150, 55, { tone: "primary" }), tile("six", "6", 320, 55, { visible: false })], "4 < 5 < 7"),
  ]),
  place_value: frames("place_value", [
    board("3 × 10 + ? × 1", [tile("ten0", "10", 55), tile("ten1", "10", 110), tile("ten2", "10", 165), tile("ones", "?", 245)]),
    board("3 × 10 + ? × 1", [tile("ten0", "10", 55), tile("ten1", "10", 110), tile("ten2", "10", 165), tile("ones", "6", 245, 55, { tone: "primary" })], "3 × 2 = 6"),
    board("3 × 10 + 6 × 1", [tile("ten0", "10", 80, 55, { visible: false }), tile("ten1", "30", 100, 55, { tone: "secondary" }), tile("ten2", "10", 120, 55, { visible: false }), tile("ones", "6", 200, 55, { tone: "primary" }), plain("plus", "+", 150)], "30 + 6 = 36"),
  ]),
  multiply_add: frames("multiply_add", [0, 1, 2].map(step => board("2 × 3 + 2 = ?", counters(8, "●", i => step === 2 ? [60 + i % 4 * 60, 36 + Math.floor(i / 4) * 50]
    : i < 6 ? [70 + i % 3 * 40, 35 + Math.floor(i / 3) * 44] : [235, 35 + (i - 6) * 44], i => ({ visible: i < 6 || step > 0, tone: i < 6 ? "secondary" : "primary" })), step === 2 ? "6 + 2 = 8" : step === 1 ? "2 × 3 = 6" : undefined))),
  multiply_subtract: takeAway("multiply_subtract", "🍪", 9, [2, 3], "3 × 3 − 2 − 1 = ?", ["9 − 2 = 7", "7 − 1 = 6"]),
  fraction_left: frames("fraction_left", [6, 5, 3].map((n, i) => board("6 − 1 − 2 = ?", parts(6, n), i === 2 ? "3 / 6" : undefined))),
  rate: working("rate", "24 ÷ 3 × 4 = ?", [["24", "÷3", "?"], ["24", "÷3", "8"], ["8", "×4", "32"]], [undefined, "24 ÷ 3 = 8", "8 × 4 = 32"]),
  percent: frames("percent", [0, 1, 2].map(step => board("20 → +25% → ?", [
    ...Array.from({ length: 4 }, (_, i) => tile(`quarter-${i}`, step === 0 ? "?" : "5", 54 + i * 64, step === 2 && i === 0 ? 106 : 40, { tone: i === 0 && step > 0 ? "primary" : undefined })),
    plain("quarter", "25%", 54, 106, { visible: step < 2, tone: "primary" }),
    plain("price", "20 + 5", 170, 106, { visible: step === 2 }),
  ], step === 2 ? "20 + 5 = 25" : step === 1 ? "20 ÷ 4 = 5" : undefined))),
  compare: frames("compare", [
    board("2 + 4    ?    2 × 0", [tile("left", "?", 80), tile("right", "?", 220)]),
    board("2 + 4    ?    2 × 0", [tile("left", "6", 80, 55, { tone: "secondary" }), tile("right", "0", 220)]),
    board("2 + 4    ?    2 × 0", [tile("left", "6", 105, 55, { tone: "primary", scale: 1.2 }), tile("right", "0", 215), plain("compare", ">", 160, 55, { tone: "primary" })], "6 > 0"),
  ]),
  operation_path: working("operation_path", "9 → ? → 10", [["9", "÷3", "?"], ["9", "÷3", "3"], ["3", "+7", "10"]], [undefined, "9 ÷ 3 = 3", "3 + 7 = 10"]),
  target_build: frames("target_build", [
    board("3 ? 2 ? 5 = 13", [tile("three", "3", 42), tile("two", "2", 150), tile("five", "5", 258)]),
    board("3 + 2 × 5 = ?", [tile("three", "3", 42), tile("two", "2", 150, 55, { tone: "primary" }), tile("five", "5", 258, 55, { tone: "primary" }), plain("multiply", "×", 204, 55, { tone: "primary" }), plain("plus", "+", 96)], "2 × 5 = 10"),
    board("3 + 2 × 5 = ?", [tile("three", "3", 80), tile("two", "10", 220, 55, { tone: "secondary" }), tile("five", "5", 220, 55, { visible: false }), plain("multiply", "×", 220, 55, { visible: false }), plain("plus", "+", 150)], "3 + 10 = 13"),
  ]),
  fraction_build: frames("fraction_build", [0, 1, 2].map(n => board("2 / 5", parts(5, n), n === 2 ? "2 / 5" : undefined))),
  true_false: frames("true_false", [0, 1, 2].map(step => board("3 × 3 = 8   ?", counters(9, "●", i => [62 + i % 3 * 88, 30 + Math.floor(i / 3) * 40], i => ({ visible: i < (step === 0 ? 3 : 9), tone: "secondary" })), step === 2 ? "9 ≠ 8" : step === 1 ? "3 + 3 + 3 = 9" : undefined))),
  balance: frames("balance", [0, 1, 2].map(step => board("4 + ? = 10", [
    ...counters(10, "●", i => [170 + i % 5 * 22, 30 + Math.floor(i / 5) * 32], () => ({ tone: "secondary" })),
    ...counters(10, "●", i => [24 + i % 5 * 22, 30 + Math.floor(i / 5) * 32], i => ({ tone: i < 4 ? "secondary" : "primary", visible: i < 4 || step > 0 })).map(t => ({ ...t, id: `left-${t.id}` })),
    plain("equal", step === 2 ? "=" : "?", 150, 104, { tone: "primary" }),
  ], step === 2 ? "4 + 6 = 10" : step === 1 ? "10 − 4 = 6" : undefined))),
  pair_sum: frames("pair_sum", [0, 1, 2].map(step => board("? + ? = 8", [
    tile("two", "2", step === 0 ? 42 : 96, 45, { tone: step > 0 ? "secondary" : undefined }),
    tile("six", "6", step === 0 ? 114 : 204, 45, { tone: step > 0 ? "secondary" : undefined }),
    tile("three", "3", 186, step > 0 ? 115 : 45, { tone: "muted", visible: step < 2 }),
    tile("one", "1", 258, step > 0 ? 115 : 45, { tone: "muted", visible: step < 2 }),
    plain("plus", "+", 150, 45, { visible: step > 0 }),
  ], step === 2 ? "2 + 6 = 8" : undefined))),
  fix_mistake: takeAway("fix_mistake", "●", 9, [3, 3], "9 − 3 = 7   ?", ["9 − 3 = 6", "6 ≠ 7"]),
  estimate: frames("estimate", [0, 1, 2].map(step => board("32 + 46 ≈ ?", [
    tile("first", step === 0 ? "32" : "30", step === 2 ? 110 : 62, 55, { tone: step > 0 ? "secondary" : undefined }),
    tile("second", step === 0 ? "46" : "50", step === 2 ? 190 : 238, 55, { tone: step > 0 ? "secondary" : undefined }),
    plain("plus", "+", 150),
  ], step === 2 ? "30 + 50 = 80" : step === 1 ? "32 ≈ 30    46 ≈ 50" : undefined))),
  fair_share: share("fair_share", 9, true),
  fraction_equivalent: frames("fraction_equivalent", [
    board("1 / 3 = ? / 6", parts(3, 1)),
    board("1 / 3 = ? / 6", [...parts(3, 1, 28), ...parts(6, 2, 100, "small")]),
    board("1 / 3 = ? / 6", [...parts(3, 1, 28), ...parts(6, 2, 100, "small")], "1 / 3 = 2 / 6"),
  ]),
  fraction_match: frames("fraction_match", [0, 1, 2].map(step => board("? / ?", [
    ...parts(5, 3).map((t, i) => ({ ...t, x: step === 2 ? 40 + i * 30 : t.x, scale: step === 2 ? .625 : 1, label: step === 1 ? String(i + 1) : "" })),
    plain("match", "↔", 206, 52, { visible: step === 2 }),
    tile("fraction", "3/5", 258, 52, { visible: step === 2, width: 56, tone: "primary" }),
  ], step === 2 ? "3 / 5" : undefined))),
  pattern_next: frames("pattern_next", [0, 1, 2].map(step => board("3 → 6 → 9 → ?", [
    ...["3", "6", "9", step === 2 ? "12" : "?"].map((n, i) => tile(`sequence-${i}`, n, 42 + i * 72, 72, { tone: i === 3 && step === 2 ? "primary" : undefined })),
    ...[0, 1, 2].map(i => plain(`jump-${i}`, "+3 →", 78 + i * 72, 25, { visible: step > 0, tone: "primary" })),
  ], step === 2 ? "9 + 3 = 12" : undefined))),
  function_machine: frames("function_machine", [0, 1, 2].map(step => board("4 → ? → 12", [
    tile("traveller", step === 2 ? "12" : "4", step === 0 ? 42 : step === 1 ? 150 : 258, 78, { tone: "secondary" }),
    tile("machine", step === 0 ? "?" : "×3", 150, 24, { tone: "primary" }),
    plain("arrow-in", "→", 88, 78), plain("arrow-out", "→", 210, 78),
  ], step === 2 ? "5 × 3 = 15" : step === 1 ? "4 × 3 = 12" : undefined))),
  order_numbers: frames("order_numbers", [
    board("→", numbers(["8", "2", "6"])),
    board("→", numbers(["8", "2", "6"], [148, 52, 244], [undefined, "primary"])),
    board("→", numbers(["8", "2", "6"], [244, 52, 148], [undefined, "primary", "secondary"]), "2 < 6 < 8"),
  ]),
};
