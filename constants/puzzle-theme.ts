import { GameColors } from "@/constants/game";

/** Puzzle palette; the home puzzle action and startup loader also share its Berry accent. */
export const PuzzleColors = {
  ...GameColors,
  background: "#FFFFFF",
  card: "#FFFFFF",
  cardBorder: "#D7DDE8",
  primary: "#C32468",
  primaryTop: "#CF296D",
  primaryDark: "#931445",
  secondary: "#C32468",
  secondaryDark: "#8D1749",
  selectedSurface: "#FFF0F6",
  selectedStrong: "#FFE0ED",
  recommendationTop: "#D7F5E9",
  recommendationSurface: "#F2FBF7",
  text: "#24314B",
  textMuted: "#5E687B",
  coin: "#FFC83D",
  coinText: "#765207",
  rewardSurface: "#FFF3BF",
  success: "#267324",
  successSurface: "#EEFBDE",
  /** Lesson progress: matte Berry fill on a blush rail, with a paw badge at the front edge. */
  progress: "#C32468",
  progressRail: "#F4E4EC",
  progressTick: "#E5C3D3",
  progressTrack: "#E7EAF2",
  incorrect: "#C82E39",
  incorrectSurface: "#FFF0F0",
  warning: "#8B551C",
  warningSurface: "#FFF1DB",
  challenge: "#8036CD",
  challengeSurface: "#F0D8FF",
  headerGlow: "#D7F5E9",
  playGlow: "#D7F5E9",
  rewardGlow: "#D7F5E9",
} as const;

/**
 * Math Mews diagram system ("flat matte"). Every puzzle visual draws from these
 * roles; see docs/PUZZLE_STYLE_GUIDE.md. Three quantity hues (teal, violet,
 * amber) each have a fill, a strong edge (≥3:1 on white), a soft surface and a
 * unit-grid line (≥3:1 on white). Berry is reserved for actions and selection.
 */
export const Ink = {
  /** Numbers, symbols and labels. 13:1 on white. */
  text: '#24314B',
  /** Secondary labels and axis numbers. 6.4:1 on white. */
  soft: '#526176',
  /** Essential neutral lines: axes, ticks, unknown-value outlines. 3.7:1 on white. */
  line: '#798698',
  /** Incidental guides that carry no value (gridlines behind bars). */
  guide: '#E3E8EF',
  /** Neutral work tray behind a model. */
  tray: '#F5F7FB',
  trayEdge: '#D7DDE8',
} as const;

/**
 * Unit lines must stay ≥3:1 against the surface they sit on:
 * `grid` on paper, `edge` on `soft`, `onFill` on `fill`.
 */
export const Quantity = {
  teal: { fill: '#4FB5CC', edge: '#2B7F93', soft: '#E3F4F7', grid: '#4E9DB1', light: '#A8DCE8', onFill: '#1B5967' },
  violet: { fill: '#9C7BD4', edge: '#6A4A9C', soft: '#F0EAF8', grid: '#8C6CC8', light: '#C9B6EC', onFill: '#4A2F78' },
  amber: { fill: '#F5B651', edge: '#9A6517', soft: '#FFF3DC', grid: '#B07A22', light: '#FAD9A0', onFill: '#8A5A12' },
  berry: { fill: '#E0518E', edge: '#73103B', soft: '#FFF0F6', grid: '#C32468', light: '#F7B6D2', onFill: '#6E0F35' },
} as const;
export type QuantityHue = keyof typeof Quantity;

/** Stroke widths in points at 1× diagram scale. */
export const Stroke = {
  /** Outer silhouette of a model, axis, beam, vessel. */
  outline: 2,
  /** Major divisions (tens, whole-number ticks). */
  major: 1.5,
  /** Unit divisions inside a whole. */
  unit: 1,
  /** A path the learner follows (hops, routes, active edge). */
  active: 2.5,
  /** Dashed outline of a passive unknown. */
  unknown: 1.5,
} as const;

export const Radius = {
  control: 16,
  tray: 12,
  piece: 6,
} as const;

/** One tempo for every puzzle animation. Durations in ms. */
export const Motion = {
  /** Press, toggle and selection response. */
  tap: 120,
  /** One conceptual move: a group joins, a hop lands, a layer fills. */
  step: 450,
  /** Pause after a meaningful landing so the eye can catch up. */
  hold: 250,
  /** Fade in the final equation or label. */
  settle: 280,
  /** Delay before a reveal starts so the starting state is seen. */
  lead: 300,
  /** A long continuous move (pour, clock sweep, rotation). Scale by distance, max 2×. */
  sweep: 900,
  /** Reduce Motion: cross-fade to the final state instead of travelling. */
  fade: 120,
  /** Delay between pieces of one group so a group reads as many, not one pile (per ten / per group). */
  stagger: 40,
  /** Inactive parts of a model while one part is acting. */
  dimOpacity: 0.4,
  /** A solution reveal never runs shorter than this, so a child can follow it. */
  minReveal: 1800,
} as const;

/** Landing character for pieces that arrive (coins, tiles, markers, pans). */
export const LandSpring = { damping: 14, stiffness: 220, mass: 0.8 } as const;
/** Minimum drawn stroke for object glyphs at any display size, in points. */
export const MIN_GLYPH_STROKE = 1;

/** Shared materials for learning diagrams; geometry and scales remain exact. */
export const DiagramColors = {
  highlight: '#FFFFFF00',
  empty: Ink.guide,
  glass: Quantity.teal.soft,
  glassEdge: Quantity.teal.edge,
  waterTop: Quantity.teal.fill,
  waterLine: Quantity.teal.edge,
  gold: Quantity.amber.fill,
  goldLight: Quantity.amber.light,
  goldEdge: Quantity.amber.edge,
  geometrySurface: Quantity.teal.soft,
  geometryGrid: Quantity.teal.grid,
  geometryFill: Quantity.teal.fill,
  geometryEdge: Quantity.teal.edge,
  // Stable family colors apply to both the model and its worked examples.
  fractionSurface: Quantity.violet.soft,
  fractionGrid: Quantity.violet.grid,
  fractionFill: Quantity.violet.fill,
  fractionEdge: Quantity.violet.edge,
  decimalSurface: Quantity.amber.soft,
  decimalGrid: Quantity.amber.grid,
  decimalFill: Quantity.amber.fill,
  decimalEdge: Quantity.amber.edge,
  solidTop: '#E4D8F2',
  solidFront: '#B89AD5',
  solidSide: '#9070B2',
} as const;

/** Nested model corners share a centre: inner radius = outer radius − inset. */
export const DiagramFrameMetrics = { outerRadius: 12, inset: 6 } as const;

/** The topic trail's tabletop palette; other puzzle screens retain their own surfaces. */
export const TopicPathColors = {
  background: "#FFFCF7",
  header: "#E3F4EC",
  text: "#203650",
  textMuted: "#607970",
  progress: PuzzleColors.challenge,
  progressTrack: "#E9E2F1",
  connection: "#DAC4E8",
  completedConnection: "#BA8BD9",
  check: "#4B9461",
  checkBorder: "#B9D9B6",
  calloutSurface: "#FCE8EF",
  calloutText: "#A51658",
  completed: { top: "#FFFEF8", face: "#F7EFDF", edge: "#D9CCB8", border: "#EEE3D0", inset: "#E8DDCA90", text: "#24314B" },
  locked: { top: "#F0F4ED", face: "#E7EEE2", edge: "#CBD8CB", border: "#DCE5DB", inset: "#FFFFFF80", text: "#617B6D" },
  current: { top: "#EF0084", face: "#DD0073", edge: "#AE0054", border: "#E84297", inset: "#FFFFFF48", text: "#FFFFFF" },
  halo: "#F9D8E7",
} as const;

function faceRadius(side: number, fraction: number, min: number, max: number) {
  'worklet';
  return Math.max(0, Math.min(side / 2, max, Math.max(min, side * fraction)));
}

export const Shape = {
  tile(shortSide: number) { 'worklet'; return faceRadius(shortSide, .18, 3, 8); },
  barTop(width: number, height: number) { 'worklet'; return Math.min(faceRadius(width, .16, 0, 4), Math.max(0, height / 4)); },
  stripEnd(height: number) { 'worklet'; return faceRadius(height, .30, 0, 6); },
  vertex(shortestEdge: number) { 'worklet'; return faceRadius(shortestEdge, .08, 0, 3); },
  tray(shortSide: number) { 'worklet'; return faceRadius(shortSide, .12, 12, 16); },
  card(shortSide: number) { 'worklet'; return faceRadius(shortSide, .16, 12, 16); },
  coin(diameter: number) { 'worklet'; return Math.max(0, diameter / 2); },
  jug: {
    heel(width: number) { 'worklet'; return faceRadius(width, .08, 4, 12); },
    rim(width: number) { 'worklet'; return faceRadius(width, .12, 2, 5); },
  },
  stroke: { silhouette: 3, small: 2, axis: 2, major: 2, minor: 1.5, seam: 0, overview: 1, active: 3, unknown: 2, guide: 2 },
  space: { loose: 4, group: 8, seam: 4 },
  empty: '#DDE3EC',
  emptyLip: '#C5CEDA',
  // Legacy colour consumers draw no rim. Shape.stroke.seam is also zero.
  emptyEdge: 'transparent',
  seamColor: PuzzleColors.background,
  lip: 3,
  detail: 2,
} as const;

export const ProofMotion = {
  lead: 100, press: 80, travel: 180, countStride: 100, group: 240, sweep: 360,
  settle: 120, fade: 120, maxCountTravel: 1200, denseHold: 1000, reward: 120, land: 140, finale: 240,
  // Leave a native scheduling frame before the 200 ms ready-to-movement deadline.
  maxLead: 180,
  repeatHold: 200, minAction: 1000, inspection: 360, standardBudget: 2800, symmetryBudget: 3500, denseBudget: 4500,
  beat: { 100: 100, 120: 120, 140: 140, 160: 160, 180: 180, 200: 200, 240: 240, 300: 300, 360: 360 },
} as const;

/** Duration of each round after the opening movement. */
export function roundDur(rounds: number) {
  return Math.max(100, Math.min(ProofMotion.group, 1500 / Math.max(1, rounds)));
}

/** A beat may carry multiple whole rounds. Update the visible count with roundsAt(landed). */
export function proofTempo({ rounds, dense = false, kind = 'deal', lead = ProofMotion.lead }: {
  rounds: number; dense?: boolean; kind?: 'deal' | 'pour' | 'exchange' | 'symmetry'; lead?: number;
}) {
  const total = Math.max(0, Math.floor(rounds));
  const budget = kind === 'symmetry' ? ProofMotion.symmetryBudget : dense ? ProofMotion.denseBudget : ProofMotion.standardBudget;
  const duration = roundDur(total);
  const between = kind === 'pour' ? 0 : kind === 'exchange' ? ProofMotion.inspection : ProofMotion.repeatHold;
  const lastHold = dense || kind === 'exchange' ? ProofMotion.inspection : ProofMotion.settle;
  // A caller may reserve an intro or outro in its lead allowance. Only the capped lead is scheduled as idle time.
  const available = budget - lead - lastHold - ProofMotion.finale;
  const travelCapacity = 1 + Math.floor((available - ProofMotion.group) / (duration + between));
  const holdCapacity = between ? 1 + Math.floor((available - ProofMotion.minAction) / between) : total;
  const capacity = Math.max(1, Math.min(travelCapacity, holdCapacity));
  const batchSize = Math.max(1, Math.ceil(total / capacity));
  const count = Math.ceil(total / batchSize);
  const travel = ProofMotion.group + Math.max(0, count - 1) * duration;
  // Let a short action unfold across the model. Never pad it with an empty hold.
  const opening = ProofMotion.group + Math.max(0, Math.min(ProofMotion.minAction, available - (count - 1) * between) - travel);
  return {
    count, batchSize, budget, lead: Math.min(lead, ProofMotion.maxLead), minTotal: 0, reducedSteps: true,
    roundDur: duration,
    roundsAt: (landed: number) => Math.min(total, Math.max(0, landed) * batchSize),
    step: (beat: number) => beat === 0 ? opening : duration,
    hold: (landed: number) => landed >= count ? lastHold : between,
  };
}
