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
  progress: "#5BAE13",
  progressTop: "#91E83D",
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

/** Shared materials for learning diagrams; geometry and scales remain exact. */
export const DiagramColors = {
  highlight: '#FFFFFF55',
  empty: '#E7EAF2',
  glass: '#EAF8FC',
  glassEdge: '#5BA9BF',
  waterTop: '#58C6D9',
  waterLine: '#267986',
  gold: '#F7B85C',
  goldLight: '#FFCF85',
  goldEdge: '#D8933E',
  geometrySurface: '#E5F5FB',
  geometryGrid: '#A3D5E4',
  geometryFill: '#40B4D5',
  geometryEdge: '#19758F',
  // Stable family colors apply to both the model and its worked examples.
  fractionSurface: '#F2ECFA',
  fractionGrid: '#CDBBE6',
  fractionFill: '#9874D0',
  fractionEdge: '#65438F',
  decimalSurface: '#FFF3DF',
  decimalGrid: '#EACD98',
  decimalFill: '#F7B85C',
  decimalEdge: '#D8933E',
  solidTop: '#D9C5F4',
  solidFront: '#B491DF',
  solidSide: '#9170C6',
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
