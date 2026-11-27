import type { QuantityTaskModel } from "@/types/puzzle";
import type { PracticeToken } from "@/types/visual-explanation";

function counter(id: number, x: number, y: number, primary = false): PracticeToken {
  return { id: `counter-${id}`, label: "", shape: "part", width: 12, height: 12, x, y, tone: primary ? "primary" : "blue" };
}

export function getQuantityTaskHeight(model: QuantityTaskModel): number {
  if (model.kind === "array") return arrayLayout(model.rows, model.columns).height;
  if (model.kind === "share") return 140;
  return countingLayout(model).height;
}

/** Token snapshots are also consumed by the offline curriculum and geometry checks. */
export function getQuantityTaskTokens(model: QuantityTaskModel, step: number, dealtCount?: number): PracticeToken[] {
  if (model.kind === "array") {
    return arrayLayout(model.rows, model.columns).pieces.map((item, i) => ({
      ...counter(i, item.from.x, item.from.y), object: model.object, width: item.size, height: item.size,
    }));
  }
  if (model.kind !== 'share') {
    return countingLayout(model).pieces.map((item, i) => {
      const p = step > 0 ? item.to : item.from;
      const token = counter(i, p.x, p.y, model.kind === 'join' ? !item.secondary : item.remove);
      return { ...token, object: model.object, width: item.size, height: item.size,
        visible: !(step > 0 && item.remove) };
    });
  }
  const tokens = sharingTokens(model, step, dealtCount);
  if (!model.object) return tokens;
  return tokens.map(token => token.id.startsWith("counter-") ? {
    ...token, object: model.object, width: 16, height: 16,
  } : token);
}

function sharingTokens(model: Extract<QuantityTaskModel, { kind: 'share' }>, step: number, dealtCount?: number): PracticeToken[] {
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

type Point = { x: number; y: number };
export type QuantityPiece = {
  from: Point; to: Point; size: number; endSize: number;
  turn: number; secondary?: boolean; remove?: boolean;
};
export type QuantityTray = { x: number; y: number; width: number; height: number; group?: number; row?: number; kind?: 'rack' };
export type QuantityLayout = { height: number; beats: number; pieces: QuantityPiece[]; trays: QuantityTray[] };

const width = 300;
function point(x: number, y: number): Point { return { x, y }; }
function piece(from: Point, size: number, turn = -1, to = from, endSize = size): QuantityPiece {
  return { from, to, size, endSize, turn };
}

/** Rows remain rows in every frame. A reveal traces them in reading order. */
function arrayLayout(rows: number, columns: number, available = 284): QuantityLayout {
  const dy = Math.min(46, available / rows);
  const dx = Math.min(64, 246 / columns);
  const size = Math.min(44, dx - 2, dy - 1);
  const left = (width - columns * dx) / 2;
  const trays = Array.from({ length: rows }, (_, row) => ({
    x: left, y: 4 + row * dy, width: dx * columns, height: dy - 1, row,
  }));
  const pieces = Array.from({ length: rows * columns }, (_, i) => {
    const row = Math.floor(i / columns);
    return piece(point(left + (i % columns + .5) * dx, 4 + (row + .5) * dy), size, row);
  });
  return { height: rows * dy + 8, beats: rows, trays, pieces };
}

/** Fit whole trays around fixed-size pieces. A wider label can move a tray to the next row. */
export function sharingLayout(items: number, groups: number, stageWidth: number, size: number, gutter: number,
  { labelWidth = 0, labelHeight = 0, plate = false, summaryAfter = 0, summaryHeight = 0 }: {
    labelWidth?: number; labelHeight?: number; plate?: boolean; summaryAfter?: number; summaryHeight?: number;
  } = {}) {
  const each = Math.floor(items / groups);
  const pitch = size + gutter;
  const pad = plate ? 12 : 5;
  const groupGap = 8;
  const minCols = Math.min(2, Math.max(1, each));
  const minWidth = Math.max(labelWidth, minCols * pitch - gutter + 2 * pad);
  const across = Math.max(1, Math.min(groups, Math.floor((stageWidth + groupGap) / (minWidth + groupGap))));
  const slotWidth = (stageWidth - (across - 1) * groupGap) / across;
  const columns = Math.max(1, Math.min(Math.ceil(Math.sqrt(each)), Math.floor((slotWidth - 2 * pad + gutter) / pitch)));
  const trayWidth = Math.min(slotWidth, Math.max(labelWidth, columns * pitch - gutter + 2 * pad, plate ? 90 : 74));
  const trayHeight = Math.max(plate ? 54 : 44, Math.ceil(each / columns) * pitch - gutter + 2 * pad);
  const rowPitch = trayHeight + labelHeight + groupGap;
  const preferred = items % groups === 0 && each >= 2 && each <= 8 ? each : items > 15 ? 10 : 5;
  const poolCols = Math.max(1, Math.min(items, preferred, Math.floor((stageWidth - 2 * pad + gutter) / pitch)));
  const poolWidth = poolCols * pitch - gutter + 2 * pad;
  const poolHeight = Math.ceil(items / poolCols) * pitch - gutter + 2 * pad;
  const rack = { x: (stageWidth - poolWidth) / 2, y: 0, width: poolWidth, height: poolHeight, kind: 'rack' as const };
  const trays: QuantityTray[] = [rack];
  for (let group = 0; group < groups; group++) {
    const row = Math.floor(group / across);
    const inRow = Math.min(across, groups - row * across);
    const start = (stageWidth - inRow * trayWidth - (inRow - 1) * groupGap) / 2;
    trays.push({ x: start + (group % across) * (trayWidth + groupGap), y: poolHeight + 14 + row * rowPitch + (summaryAfter && row > Math.floor((summaryAfter - 1) / across) ? summaryHeight : 0),
      width: trayWidth, height: trayHeight, group });
  }
  const pieces = Array.from({ length: items }, (_, i) => {
    const pool = items - 1 - i;
    const from = point(rack.x + pad + size / 2 + pool % poolCols * pitch,
      pad + size / 2 + Math.floor(pool / poolCols) * pitch);
    if (i >= each * groups) return piece(from, size);
    const tray = trays[i % groups + 1];
    const slot = Math.floor(i / groups);
    const row = Math.floor(slot / columns);
    const rowLength = Math.min(columns, each - row * columns);
    const to = point(tray.x + trayWidth / 2 + (slot % columns - (rowLength - 1) / 2) * pitch,
      tray.y + trayHeight / 2 + (row - (Math.ceil(each / columns) - 1) / 2) * pitch);
    return piece(from, size, i, to);
  });
  return { height: poolHeight + 14 + Math.ceil(groups / across) * rowPitch + summaryHeight, beats: each, trays, pieces, across };
}

export type CountingTask = Extract<QuantityTaskModel, { left: number }>;

export function quantityLayout(model: QuantityTaskModel, available = 284): QuantityLayout {
  if ('left' in model) return countingLayout(model);
  return model.kind === 'share' ? sharingLayout(model.items, model.groups, width, 32, 4)
    : arrayLayout(model.rows, model.columns, available);
}

export type TrayBounds = { x: number; y: number; width: number; height: number };
const trayPad = 6;

type TrayMark = { value: number; added: number; row: number; col: number; x: number; y: number; height: number };

/** Ten-rods move first. If ten loose ones collect, their cells become one rod on landing. */
export function countingTrays(model: CountingTask, width: number, captionHeight = 28,
  grouped = model.kind === 'join' && model.left + model.right > 20, practice = false,
  { rodCell = 20, measuredCaptionWidth = 0, mainHeading = 0, bankHeading = 0, fitColumns = false, editorHeight, pieceFloor }: {
    rodCell?: number; measuredCaptionWidth?: number; mainHeading?: number; bankHeading?: number; fitColumns?: boolean; editorHeight?: number; pieceFloor?: number;
  } = {}) {
  const join = model.kind === 'join';
  const rods = (n: number) => grouped ? Math.floor(n / 10) : 0;
  const ones = (n: number) => n - 10 * rods(n);
  const amounts = [0];
  for (let i = 0; i < rods(model.right); i++) amounts.push(amounts[amounts.length - 1] + 10);
  for (let i = 0; i < ones(model.right); i++) amounts.push(amounts[amounts.length - 1] + 1);
  const received = join ? model.left + model.right : model.left;
  const inEditor = practice || editorHeight !== undefined;
  const gap = inEditor ? 16 : 28;
  const minPitch = pieceFloor ?? (model.object ? 38 : 29);
  const availableColumns = Math.max(2, Math.floor((width - 4 * trayPad - gap) / minPitch));
  const startColumns = Math.max(1, Math.min(5, model.left));
  const editorBankColumns = Math.max(Math.floor(availableColumns / 2), availableColumns - startColumns);
  const bankLimit = inEditor ? Math.max(1, Math.min(5, model.right, editorBankColumns)) : fitColumns ? Math.min(5, Math.floor(availableColumns / 2)) : 5;
  const mainLimit = fitColumns || inEditor ? Math.min(5, availableColumns - bankLimit) : 5;
  const mainRodRows = Math.ceil(rods(received) / mainLimit);
  const bankRodRows = Math.ceil(rods(model.right) / bankLimit);
  const stepCounts = amounts.map(n => [join ? model.left + n : model.left, join ? model.right - n : n]);
  const cols = (n: number, limit: number) => Math.min(limit, Math.max(rods(n), ones(n)));
  const mainCols = Math.max(1, ...stepCounts.map(([a]) => cols(a, mainLimit)));
  const bankCols = Math.max(1, ...stepCounts.map(([, b]) => cols(b, bankLimit)));
  const sidePitch = (width - 4 * trayPad - gap) / (mainCols + bankCols);
  const compact = practice && captionHeight > 35 && 2 * measuredCaptionWidth + gap <= width;
  const minCaptionWidth = compact ? 2 * captionHeight : 3 * captionHeight;
  const stacked = sidePitch < minPitch || (captionHeight > 35 && !compact) ||
    Math.max(mainCols * minPitch + 2 * trayPad, minCaptionWidth) + Math.max(bankCols * minPitch + 2 * trayPad, minCaptionWidth) + gap > width;
  const heightPitch = editorHeight !== undefined ? (editorHeight - 3 * trayPad) / Math.max(1, Math.ceil(received / mainLimit), Math.ceil(model.right / bankLimit)) : Infinity;
  const pitch = Math.min(Math.max(minPitch, heightPitch), compact ? minPitch : grouped ? 39 : 42, stacked ? (width - 2 * trayPad) / Math.max(mainCols, bankCols) : sidePitch);
  // Four points separate rods, and the outer borders sit outside the ten counted cells.
  const rodHeight = grouped ? rodCell * 10 + 7 : pitch;
  function rows(n: number, rodRows: number, added: number, columns: number) {
    const r = rods(n), u = ones(n);
    const incomingRods = Math.min(rods(model.right), Math.floor(added / 10));
    const addedOnes = added - incomingRods * 10;
    const carry = grouped && ones(model.left) + addedOnes >= 10;
    return Array.from({ length: r + u }, (_, i) => {
      const rod = i < r, index = rod ? i : i - r;
      const row = (rod ? 0 : rodRows) + Math.floor(index / columns);
      let part = 0;
      if (added > 0 && rod && index >= rods(model.left)) part = carry && index === r - 1 ? 10 - ones(model.left) : 10;
      if (added > 0 && !rod && (carry || index >= ones(model.left))) part = 1;
      return { value: rod ? 10 : 1, added: part, row, col: index % columns };
    });
  }
  const tenLane = inEditor ? 0 : 8;
  const rowY = (row: number, main: boolean, n: number, value: number) => {
    const rodRows = main ? mainRodRows : bankRodRows;
    const columns = main ? mainLimit : bankLimit;
    // Keep logical slots stable for flights. In the editor, skip unoccupied rod rows when painting ones.
    const visibleRodRows = inEditor && value === 1 ? Math.ceil(rods(n) / columns) : rodRows;
    return trayPad + Math.min(row, visibleRodRows) * rodHeight + Math.max(0, row - rodRows) * pitch
      + (main && join && !grouped && row >= 2 ? tenLane : 0);
  };
  const build = (n: number, main: boolean, added: number) => {
    const rodRows = main ? mainRodRows : bankRodRows;
    const columns = main ? mainLimit : bankLimit;
    const marks: TrayMark[] = rows(n, rodRows, added, columns).map(m => ({ ...m, x: trayPad + m.col * pitch,
      y: rowY(m.row, main, n, m.value), height: m.value === 10 ? rodHeight : pitch }));
    const w = marks.length ? cols(n, columns) * pitch + 2 * trayPad : 0;
    const last = marks[marks.length - 1];
    const dividerHeight = main && join && !grouped && n === 10 ? tenLane : 0;
    const h = last ? last.y + last.height + trayPad + dividerHeight : 0;
    return { marks, width: w, height: h };
  };
  const steps = stepCounts.map(([a, b], i) => ({ main: build(a, true, join ? amounts[i] : 0), bank: build(b, false, 0) }));
  const flightDest = steps.slice(0, -1).map((s, i) => {
    const next = steps[i + 1];
    const value = amounts[i + 1] - amounts[i];
    if (!join) return next.bank.marks[next.bank.marks.length - 1];
    if (value === 1 && grouped && ones(model.left + amounts[i]) === 9) {
      const row = mainRodRows + Math.floor(9 / mainLimit), col = 9 % mainLimit;
      return { value, added: 1, row, col, x: trayPad + col * pitch, y: rowY(row, true, model.left + amounts[i], value), height: pitch };
    }
    const matching = next.main.marks.filter(m => m.value === value);
    return matching[matching.length - 1];
  });
  const mainWidth = mainCols * pitch + 2 * trayPad, bankWidth = bankCols * pitch + 2 * trayPad;
  const mainHeight = Math.max(...steps.map(s => s.main.height), ...flightDest.map(m => join ? m.y + m.height + trayPad : 0));
  const bankHeight = Math.max(...steps.map(s => s.bank.height));
  const available = width - gap;
  const mainColumn = stacked ? width : Math.max(mainWidth, Math.min(available - Math.max(bankWidth, minCaptionWidth), available / 2));
  const bankColumn = stacked ? width : available - mainColumn;
  const ax = (mainColumn - mainWidth) / 2;
  const bankLeft = stacked ? 0 : mainColumn + gap;
  const bx = bankLeft + (bankColumn - bankWidth) / 2;
  const extraLines = stacked ? Math.max(0, Math.ceil(measuredCaptionWidth / width) - 1) : 0;
  const estimatedHeading = captionHeight * ((compact ? grouped ? 3.7 : 2 : join ? 2.3 : 1.4) + extraLines);
  const ay = Math.max(estimatedHeading, mainHeading, stacked ? 0 : bankHeading);
  const by = stacked ? ay + mainHeight + gap + Math.max(captionHeight * 1.5, bankHeading) : ay;
  const height = Math.max(ay + mainHeight, by + bankHeight) + trayPad;
  const frames = steps.map(s => ({ a: { x: ax, y: ay, ...s.main }, b: { x: bx, y: by, ...s.bank }, height }));
  const flights = frames.slice(0, -1).map((f, i) => {
    const value = amounts[i + 1] - amounts[i];
    const source = join ? f.b.marks.filter(m => m.value === value).at(-1)! : f.a.marks[model.left - i - 1];
    return { source, target: flightDest[i], value };
  });
  const plus = stacked ? { x: width / 2, y: ay + mainHeight + gap / 2 } : { x: mainColumn + gap / 2, y: ay + pitch / 2 + trayPad };
  return { frames, flights, amounts, height, pitch, plus, grouped, join, captionHeight, mainWidth, bankWidth, mainHeight, bankHeight, tenLane, mainColumn, bankColumn, bankLeft };
}

/** Offline snapshots keep one identity per counted unit. */
function countingLayout(model: CountingTask): QuantityLayout {
  const { frames, flights, pitch, height, join } = countingTrays(model, width, 27, false);
  const start = frames[0], end = frames[frames.length - 1];
  const center = (tray: TrayBounds, slot: Point) => point(tray.x + slot.x + pitch / 2, tray.y + slot.y + pitch / 2);
  const pieces = (join ? end.a : start.a).marks.map((mark, i) => {
    const turn = join ? i - model.left : model.left - 1 - i;
    const moving = turn >= 0 && turn < flights.length;
    const from = moving && join ? center(start.b, flights[turn].source) : center(start.a, mark);
    const to = moving && !join ? center(end.b, flights[turn].target) : center(end.a, mark);
    return { ...piece(from, pitch - 4, moving ? turn : -1, to), secondary: moving && join, remove: moving && !join };
  });
  return { pieces, height, beats: model.right, trays: [start.a, start.b].filter(tray => tray.width > 0) };
}

export function quantityEquation(model: QuantityTaskModel, landed: number, selectedGroups?: number, settled = false) {
  if (model.kind === 'share') {
    const each = Math.floor(model.items / model.groups);
    const remainder = model.items % model.groups;
    const divided = landed >= each && (!!selectedGroups || settled);
    const division = remainder && divided ? `${model.items} = ${model.groups} × ${each} + ${remainder}` :
      `${model.items} ÷ ${model.groups} = ${divided ? each : '?'}`;
    return selectedGroups && divided ? `${division}\n${selectedGroups} × ${each} = ${settled ? selectedGroups * each : '?'}` : division;
  }
  if (model.kind === 'array') return `${landed || model.rows} × ${model.columns} = ${landed ? landed * model.columns : '?'}`;
  const shown = !settled && landed === model.right ? Math.max(0, landed - 1) : landed;
  const join = model.kind === 'join';
  return `${model.left} ${join ? '+' : '−'} ${shown || model.right} = ${shown ? model.left + (join ? shown : -shown) : '?'}`;
}
