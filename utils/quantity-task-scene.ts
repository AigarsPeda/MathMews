import type { QuantityTaskModel } from "@/types/puzzle";
import type { PracticeToken } from "@/types/visual-explanation";

function counter(id: number, x: number, y: number, primary = false): PracticeToken {
  return { id: `counter-${id}`, label: "", shape: "part", width: 12, height: 12, x, y, tone: primary ? "primary" : "blue" };
}

export function getQuantityTaskHeight(model: QuantityTaskModel): number {
  if (model.kind === "array") {
    const pitch = model.object ? model.rows * model.columns > 64 ? 18 : 28 : 16;
    return Math.max(140, Math.max(model.rows, Math.ceil(model.rows * model.columns / 10)) * pitch + 24);
  }
  if (model.kind === "share") return 140;
  const groupRows = model.kind === "join" ? Math.ceil(Math.max(model.left, model.right) / 5) : 0;
  const resultRows = Math.ceil((model.kind === "join" ? model.left + model.right : model.left) / 10);
  return Math.max(92, 62 + (Math.max(groupRows, resultRows) - 1) * 28);
}

/** The mouse sprite is a landscape cutout. Size it for both the loose pile and
 * the finished array so sorting moves each toy without changing its size. */
function mouseArray(model: Extract<QuantityTaskModel, { kind: 'array' }>, built: boolean): PracticeToken[] {
  const count = model.rows * model.columns;
  const pileColumns = Math.min(count, 10, Math.ceil(Math.sqrt(count * 1.5)));
  const maxColumns = Math.max(model.columns, pileColumns);
  const maxRows = Math.max(model.rows, Math.ceil(count / pileColumns));
  const boardHeight = getQuantityTaskHeight(model);
  const cellWidth = 288 / maxColumns;
  const cellHeight = (boardHeight - 12) / maxRows;
  const width = Math.min(96, cellWidth * .90, cellHeight * 1.22);
  const height = width * 2 / 3;
  const columns = built ? model.columns : pileColumns;
  const rows = Math.ceil(count / columns);
  const pitchX = Math.min(cellWidth, width * (built ? 1.32 : 1.12));
  const pitchY = Math.min(cellHeight, height * 1.25);
  const clearance = rows === 1 ? (boardHeight - height) / 2 : Math.max(0, (pitchY - Math.max(height, 12)) / 2);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns), col = i % columns;
    const inRow = Math.min(columns, count - row * columns);
    const x = 150 + (col - (inRow - 1) / 2) * pitchX;
    const stagger = built ? 0 : (col % 2 ? 1 : -1) * Math.min(height * .32, clearance * .70);
    const y = boardHeight / 2 + (row - (rows - 1) / 2) * pitchY + stagger;
    // Start each row as a group, then let neighbours arrive a little apart.
    const delayMs = built ? Math.round(row * Math.min(210, 700 / Math.max(1, rows - 1))
      + col * Math.min(80, 140 / Math.max(1, columns - 1))) : 0;
    const arc = -Math.min(13, height * .22, Math.max(0, clearance * .30));
    return { ...counter(i, x, y), object: model.object, width, height, arc, delayMs };
  });
}

/** Stable identities let counters travel between the pool and their destinations. */
export function getQuantityTaskTokens(model: QuantityTaskModel, step: number, dealtCount?: number): PracticeToken[] {
  if (model.kind === "array" && model.object === "mouse") return mouseArray(model, step > 0);
  const tokens = buildQuantityTaskTokens(model, step, dealtCount);
  if (!model.object) return tokens;
  return tokens.map(token => token.id.startsWith("counter-") ? {
    ...token, object: model.object,
    width: model.kind === "share" ? 16 : model.kind === "array" ? Math.min(model.rows * model.columns > 64 ? 16 : 24, 270 / model.columns) : 24,
    height: model.kind === "share" || model.kind === "array" && model.rows * model.columns > 64 ? 16 : 24,
  } : token);
}

function buildQuantityTaskTokens(model: QuantityTaskModel, step: number, dealtCount?: number): PracticeToken[] {
  if (model.kind === "share") {
    const limit = Math.floor(model.items / model.groups) * model.groups;
    const dealt = Math.min(limit, Math.max(0, Math.floor(dealtCount ?? step * model.groups)));
    const plates: PracticeToken[] = Array.from({ length: model.groups }, (_, group) => ({
      id: `plate-${group}`, label: "", shape: "tile", tone: "muted",
      x: (group + 0.5) * 300 / model.groups, y: 103,
      width: 300 / model.groups - 8, height: 66,
    }));
    return [...plates, ...Array.from({ length: model.items }, (_, index) => {
      if (index >= dealt) {
        const pool = dealtCount === undefined ? index - dealt : index;
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
        : counter(index, 24 + (index % 10) * 28, 18 + Math.floor(index / 10) * (model.object ? model.rows * model.columns > 64 ? 18 : 26 : 15), row % 2 === 0);
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
