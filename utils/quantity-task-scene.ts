import type { QuantityTaskModel } from "@/types/puzzle";
import type { PracticeToken } from "@/types/visual-explanation";

function counter(id: number, x: number, y: number, primary = false): PracticeToken {
  return { id: `counter-${id}`, label: "", shape: "part", width: 12, height: 12, x, y, tone: primary ? "primary" : "blue" };
}

export function getQuantityTaskHeight(model: QuantityTaskModel): number {
  return model.kind === "array" ? Math.max(140, model.rows * (model.object ? 28 : 16) + 24) : 140;
}

/** Stable identities let counters travel between the pool and their destinations. */
export function getQuantityTaskTokens(model: QuantityTaskModel, step: number): PracticeToken[] {
  const tokens = buildQuantityTaskTokens(model, step);
  if (!model.object) return tokens;
  return tokens.map(token => token.id.startsWith("counter-") ? {
    ...token, object: model.object,
    width: model.kind === "share" ? 16 : model.kind === "array" ? Math.min(24, 270 / model.columns) : 24,
    height: model.kind === "share" ? 16 : 24,
  } : token);
}

function buildQuantityTaskTokens(model: QuantityTaskModel, step: number): PracticeToken[] {
  if (model.kind === "share") {
    const dealt = Math.min(Math.max(0, Math.floor(step)), Math.floor(model.items / model.groups)) * model.groups;
    const plates: PracticeToken[] = Array.from({ length: model.groups }, (_, group) => ({
      id: `plate-${group}`, label: "", shape: "tile", tone: "muted",
      x: (group + 0.5) * 300 / model.groups, y: 103,
      width: 300 / model.groups - 8, height: 66,
    }));
    return [...plates, ...Array.from({ length: model.items }, (_, index) => {
      if (index >= dealt) {
        const pool = index - dealt;
        return counter(index, 24 + (pool % 10) * 28, 12 + Math.floor(pool / 10) * 16);
      }
      const group = index % model.groups, round = Math.floor(index / model.groups);
      return counter(index, (group + 0.5) * 300 / model.groups + ((round % 3) - 1) * (model.object ? 18 : 14), 85 + Math.floor(round / 3) * (model.object ? 18 : 16), group % 2 === 0);
    })];
  }
  if (model.kind === "array") {
    return Array.from({ length: model.rows * model.columns }, (_, index) => {
      const row = Math.floor(index / model.columns), column = index % model.columns;
      return step > 0
        ? counter(index, (column + 0.5) * 300 / model.columns, 15 + (row + 0.5) * (getQuantityTaskHeight(model) - 30) / model.rows, row % 2 === 0)
        : counter(index, 24 + (index % 10) * 28, 18 + Math.floor(index / 10) * (model.object ? 26 : 15), row % 2 === 0);
    });
  }
  const count = model.kind === "join" ? model.left + model.right : model.left;
  return Array.from({ length: count }, (_, index) => {
    if (model.kind === "join" && step === 0) {
      const right = index >= model.left, local = right ? index - model.left : index;
      return counter(index, (right ? 178 : 22) + (local % 5) * 25, 42 + Math.floor(local / 5) * 28, !right);
    }
    const token = counter(index, 24 + (index % 10) * 28, 42 + Math.floor(index / 10) * 28, model.kind === "join" && index < model.left);
    if (model.kind === "take_away" && index >= model.left - model.right) {
      token.tone = "primary";
      if (step > 0) { token.y += 45; token.visible = false; }
    }
    return token;
  });
}
