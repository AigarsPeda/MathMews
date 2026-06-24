import type {
  VisualExplanation,
  VisualKeyframe,
  VisualScene,
} from '@/types/visual-explanation';

export function getVisualExplanation(
  puzzleId: string,
): VisualExplanation | null {
  return VISUAL_EXPLANATIONS[puzzleId] ?? null;
}

export function hasVisualExplanation(puzzleId: string): boolean {
  return puzzleId in VISUAL_EXPLANATIONS;
}

type InterpolatedFrame = {
  captionKey: string;
  scene: VisualScene;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundLerp(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}

function interpolateScene(
  from: VisualScene,
  to: VisualScene,
  t: number,
): VisualScene {
  if (from.kind !== to.kind) return t < 0.5 ? from : to;

  switch (from.kind) {
    case 'items':
      return {
        ...from,
        count: roundLerp(from.count, to.count, t),
        removed: roundLerp(from.removed ?? 0, to.removed ?? 0, t),
      };
    case 'groups':
      return {
        ...from,
        groups: from.groups.map((group, index) => ({
          ...group,
          count: roundLerp(
            group.count,
            to.groups[index]?.count ?? group.count,
            t,
          ),
        })),
      };
    case 'grid':
      return {
        ...from,
        filled: roundLerp(from.filled, to.filled, t),
      };
    case 'compare':
      return {
        ...from,
        left: {
          ...from.left,
          count: roundLerp(from.left.count, to.left.count, t),
        },
        right: {
          ...from.right,
          count: roundLerp(from.right.count, to.right.count, t),
        },
        result:
          from.result !== undefined && to.result !== undefined
            ? roundLerp(from.result, to.result, t)
            : t < 0.5
              ? from.result
              : to.result,
      };
    default:
      return t < 0.5 ? from : to;
  }
}

export function interpolateVisualFrame(
  keyframes: VisualKeyframe[],
  progress: number,
): InterpolatedFrame {
  const clamped = Math.max(0, Math.min(1, progress));
  if (keyframes.length === 0) {
    return {
      captionKey: '',
      scene: { kind: 'equation', lines: ['?'] },
    };
  }
  if (keyframes.length === 1) {
    return {
      captionKey: keyframes[0].captionKey,
      scene: keyframes[0].scene,
    };
  }

  const scaled = clamped * (keyframes.length - 1);
  const index = Math.min(Math.floor(scaled), keyframes.length - 2);
  const t = scaled - index;
  const from = keyframes[index];
  const to = keyframes[index + 1];

  return {
    captionKey: t < 0.5 ? from.captionKey : to.captionKey,
    scene: interpolateScene(from.scene, to.scene, t),
  };
}

function kf(
  at: number,
  puzzleKey: string,
  step: number,
  scene: VisualScene,
): VisualKeyframe {
  return {
    at,
    captionKey: `visualHelp.${puzzleKey}.s${step}`,
    scene,
  };
}

const VISUAL_EXPLANATIONS: Record<string, VisualExplanation> = {
  'easy-01': {
    puzzleId: 'easy-01',
    keyframes: [
      kf(0, 'easy01', 0, { kind: 'items', emoji: '🍎', count: 12 }),
      kf(0.35, 'easy01', 1, { kind: 'items', emoji: '🍎', count: 12, removed: 4 }),
      kf(0.7, 'easy01', 2, { kind: 'items', emoji: '🍎', count: 8 }),
      kf(1, 'easy01', 3, {
        kind: 'equation',
        lines: ['12 − 4 = 8', '🍎🍎🍎🍎🍎🍎🍎🍎'],
        highlightLine: 0,
      }),
    ],
  },
  'easy-02': {
    puzzleId: 'easy-02',
    keyframes: [
      kf(0, 'easy02', 0, { kind: 'items', emoji: '🐑', count: 17 }),
      kf(0.4, 'easy02', 1, { kind: 'items', emoji: '🐑', count: 17, removed: 8 }),
      kf(0.75, 'easy02', 2, { kind: 'items', emoji: '🐑', count: 9 }),
      kf(1, 'easy02', 3, {
        kind: 'equation',
        lines: ['All but 9 ran away', '9 sheep stayed 🐑'],
        highlightLine: 1,
      }),
    ],
  },
  'easy-03': {
    puzzleId: 'easy-03',
    keyframes: [
      kf(0, 'easy03', 0, {
        kind: 'groups',
        emoji: '🎈',
        groups: [
          { count: 5, color: '#FF6B6B' },
          { count: 3, color: '#4ECDC4' },
        ],
      }),
      kf(0.5, 'easy03', 1, {
        kind: 'compare',
        left: { emoji: '🔴', count: 5 },
        right: { emoji: '🔵', count: 3 },
        operator: '+',
      }),
      kf(1, 'easy03', 2, {
        kind: 'equation',
        lines: ['5 + 3 = 8', '🎈🎈🎈🎈🎈🎈🎈🎈'],
        highlightLine: 0,
      }),
    ],
  },
  'easy-04': {
    puzzleId: 'easy-04',
    keyframes: [
      kf(0, 'easy04', 0, {
        kind: 'sequence',
        values: [2, 4, 6, 8, '?'],
        jumpLabel: '+2',
      }),
      kf(0.5, 'easy04', 1, {
        kind: 'sequence',
        values: [2, 4, 6, 8, '?'],
        highlightIndex: 3,
        jumpLabel: '+2',
      }),
      kf(1, 'easy04', 2, {
        kind: 'sequence',
        values: [2, 4, 6, 8, 10],
        highlightIndex: 4,
        jumpLabel: '+2',
      }),
    ],
  },
  'easy-05': {
    puzzleId: 'easy-05',
    keyframes: [
      kf(0, 'easy05', 0, { kind: 'items', emoji: '🍪', count: 10 }),
      kf(0.4, 'easy05', 1, { kind: 'items', emoji: '🍪', count: 10, removed: 3 }),
      kf(1, 'easy05', 2, {
        kind: 'equation',
        lines: ['10 − 3 = 7', '🍪🍪🍪🍪🍪🍪🍪'],
        highlightLine: 0,
      }),
    ],
  },
  'easy-06': {
    puzzleId: 'easy-06',
    keyframes: [
      kf(0, 'easy06', 0, { kind: 'grid', rows: 2, cols: 4, filled: 0 }),
      kf(0.35, 'easy06', 1, { kind: 'grid', rows: 2, cols: 4, filled: 4 }),
      kf(0.7, 'easy06', 2, { kind: 'grid', rows: 2, cols: 4, filled: 8 }),
      kf(1, 'easy06', 3, {
        kind: 'equation',
        lines: ['2 rows × 4 toys', '2 × 4 = 8 🧸'],
        highlightLine: 1,
      }),
    ],
  },
  'easy-07': {
    puzzleId: 'easy-07',
    keyframes: [
      kf(0, 'easy07', 0, {
        kind: 'sequence',
        values: [11, 12, 13, 14],
      }),
      kf(0.5, 'easy07', 1, {
        kind: 'sequence',
        values: [11, 12, 13, 14],
        highlightIndex: 0,
      }),
      kf(1, 'easy07', 2, {
        kind: 'equation',
        lines: ['Odd numbers: 11, 13', 'Answer: 11 ✓'],
        highlightLine: 1,
      }),
    ],
  },
  'easy-08': {
    puzzleId: 'easy-08',
    keyframes: [
      kf(0, 'easy08', 0, {
        kind: 'compare',
        left: { emoji: '🐚', count: 6 },
        right: { emoji: '🐚', count: 4 },
        operator: '+',
      }),
      kf(0.55, 'easy08', 1, { kind: 'items', emoji: '🐚', count: 10 }),
      kf(1, 'easy08', 2, {
        kind: 'equation',
        lines: ['6 + 4 = 10', '🐚🐚🐚🐚🐚🐚🐚🐚🐚🐚'],
        highlightLine: 0,
      }),
    ],
  },
  'medium-01': {
    puzzleId: 'medium-01',
    keyframes: [
      kf(0, 'medium01', 0, { kind: 'grid', rows: 4, cols: 6, filled: 0 }),
      kf(0.45, 'medium01', 1, { kind: 'grid', rows: 4, cols: 6, filled: 12 }),
      kf(1, 'medium01', 2, {
        kind: 'equation',
        lines: ['4 packs × 6 muffins', '4 × 6 = 24 🧁'],
        highlightLine: 1,
      }),
    ],
  },
  'medium-02': {
    puzzleId: 'medium-02',
    keyframes: [
      kf(0, 'medium02', 0, {
        kind: 'equation',
        lines: ['$35 in wallet 💵'],
      }),
      kf(0.45, 'medium02', 1, {
        kind: 'compare',
        left: { emoji: '💵', count: 35, label: 'start' },
        right: { emoji: '📚', count: 18, label: 'book' },
        operator: '−',
      }),
      kf(1, 'medium02', 2, {
        kind: 'equation',
        lines: ['$35 − $18 = $17', '💵 left'],
        highlightLine: 0,
      }),
    ],
  },
  'medium-03': {
    puzzleId: 'medium-03',
    keyframes: [
      kf(0, 'medium03', 0, {
        kind: 'sequence',
        values: [3, 6, 12, 24, '?'],
        jumpLabel: '×2',
      }),
      kf(0.55, 'medium03', 1, {
        kind: 'sequence',
        values: [3, 6, 12, 24, '?'],
        highlightIndex: 3,
        jumpLabel: '×2',
      }),
      kf(1, 'medium03', 2, {
        kind: 'equation',
        lines: ['24 × 2 = 48'],
        highlightLine: 0,
      }),
    ],
  },
  'medium-04': {
    puzzleId: 'medium-04',
    keyframes: [
      kf(0, 'medium04', 0, { kind: 'items', emoji: '👧', count: 28, maxVisible: 14 }),
      kf(0.45, 'medium04', 1, {
        kind: 'grid',
        rows: 4,
        cols: 7,
        filled: 28,
      }),
      kf(1, 'medium04', 2, {
        kind: 'equation',
        lines: ['28 ÷ 4 teams', '7 students per team 👧'],
        highlightLine: 1,
      }),
    ],
  },
  'medium-05': {
    puzzleId: 'medium-05',
    keyframes: [
      kf(0, 'medium05', 0, { kind: 'grid', rows: 3, cols: 5, filled: 15 }),
      kf(0.5, 'medium05', 1, { kind: 'items', emoji: '🔵', count: 4 }),
      kf(1, 'medium05', 2, {
        kind: 'equation',
        lines: ['3 × 5 = 15', '15 + 4 = 19 🔵'],
        highlightLine: 1,
      }),
    ],
  },
  'medium-06': {
    puzzleId: 'medium-06',
    keyframes: [
      kf(0, 'medium06', 0, {
        kind: 'equation',
        lines: ['Tens digit = 4', 'Ones digit = 2 × 4'],
      }),
      kf(0.55, 'medium06', 1, {
        kind: 'sequence',
        values: [4, 8],
        highlightIndex: 1,
      }),
      kf(1, 'medium06', 2, {
        kind: 'equation',
        lines: ['4 and 8 → 48'],
        highlightLine: 0,
      }),
    ],
  },
  'hard-01': {
    puzzleId: 'hard-01',
    keyframes: [
      kf(0, 'hard01', 0, { kind: 'items', emoji: '🍕', count: 8 }),
      kf(0.35, 'hard01', 1, { kind: 'items', emoji: '🍕', count: 8, removed: 5 }),
      kf(1, 'hard01', 2, {
        kind: 'equation',
        lines: ['8 − 5 = 3 slices', '3/8 of the pizza 🍕'],
        highlightLine: 1,
      }),
    ],
  },
  'hard-02': {
    puzzleId: 'hard-02',
    keyframes: [
      kf(0, 'hard02', 0, {
        kind: 'compare',
        left: { emoji: '🚂', count: 60, label: 'mi' },
        right: { emoji: '⏱️', count: 2, label: 'hr' },
        operator: '÷',
      }),
      kf(0.5, 'hard02', 1, {
        kind: 'equation',
        lines: ['60 ÷ 2 = 30 mph'],
        highlightLine: 0,
      }),
      kf(1, 'hard02', 2, {
        kind: 'equation',
        lines: ['30 × 5 hours', '= 150 miles 🚂'],
        highlightLine: 1,
      }),
    ],
  },
  'hard-03': {
    puzzleId: 'hard-03',
    keyframes: [
      kf(0, 'hard03', 0, {
        kind: 'equation',
        lines: ['Toy costs $40 🧸'],
      }),
      kf(0.45, 'hard03', 1, {
        kind: 'compare',
        left: { emoji: '🧸', count: 40 },
        right: { emoji: '📈', count: 10 },
        operator: '+',
        result: 50,
      }),
      kf(1, 'hard03', 2, {
        kind: 'equation',
        lines: ['25% of $40 = $10', 'New price: $50'],
        highlightLine: 1,
      }),
    ],
  },
  'hard-04': {
    puzzleId: 'hard-04',
    keyframes: [
      kf(0, 'hard04', 0, {
        kind: 'sequence',
        values: [1, 1, 2, 3, 5, 8, '?'],
      }),
      kf(0.55, 'hard04', 1, {
        kind: 'sequence',
        values: [1, 1, 2, 3, 5, 8, '?'],
        highlightIndex: 5,
        jumpLabel: '5+8',
      }),
      kf(1, 'hard04', 2, {
        kind: 'equation',
        lines: ['5 + 8 = 13'],
        highlightLine: 0,
      }),
    ],
  },
  'hard-05': {
    puzzleId: 'hard-05',
    keyframes: [
      kf(0, 'hard05', 0, { kind: 'grid', rows: 4, cols: 6, filled: 24 }),
      kf(0.35, 'hard05', 1, { kind: 'items', emoji: '🍪', count: 24, removed: 5 }),
      kf(0.7, 'hard05', 2, { kind: 'items', emoji: '🍪', count: 12 }),
      kf(1, 'hard05', 3, {
        kind: 'equation',
        lines: ['24 − 5 − 7 = 12', '🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪'],
        highlightLine: 0,
      }),
    ],
  },
  'hard-06': {
    puzzleId: 'hard-06',
    keyframes: [
      kf(0, 'hard06', 0, { kind: 'items', emoji: '🍎', count: 5 }),
      kf(0.45, 'hard06', 1, {
        kind: 'groups',
        emoji: '🍎',
        groups: [
          { count: 1, color: '#FF6B6B' },
          { count: 1, color: '#4ECDC4' },
          { count: 1, color: '#F7B731' },
        ],
      }),
      kf(1, 'hard06', 2, {
        kind: 'equation',
        lines: ['5 ÷ 3 friends', '1 each, 2 left 🍎'],
        highlightLine: 1,
      }),
    ],
  },
};
