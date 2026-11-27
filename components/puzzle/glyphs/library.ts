import { objectMaterials as materials } from '@/constants/puzzle-object-assets';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import type { PuzzleObject } from '@/types/puzzle-object';

export type ShopItem = 'apple' | 'cookie' | 'book' | 'plant' | 'balloon' | 'cupcake';
export type DiagramIconName = PuzzleObject | ShopItem | 'cat' | 'toy' | 'bottle' | 'cup' | 'bag' | 'euro' | 'cent';
export type DiagramIconTone = 'primary' | 'secondary' | 'ghost';

interface Glyph {
  material: keyof typeof materials;
  body: string;
  accent?: string;
  accentMaterial?: keyof typeof materials;
  detail?: string;
  line?: string;
  darkAccent?: boolean;
  bottomLip?: boolean;
}

const coinRim = 'M32 4 A28 28 0 1 1 31.99 4 Z';
const coinCore = 'M32 11 A21 21 0 1 1 31.99 11 Z';

export const glyphs: Record<DiagramIconName, Glyph> = {
  mouse: {
    bottomLip: true,
    material: 'violet',
    body: 'M15 41 C13 34 16 24 24 21 Q30 18 34 20 C32 13 36 7 42 7 C50 6 54 14 50 21 Q49 24 46 25 Q51 27 55 33 L60 37 Q62 39 60 42 Q51 48 42 50 Q29 54 20 50 Q16 48 15 44 Z',
    accent: 'M37 17 C36 12 39 10 43 10 C49 10 51 17 46 21 Q43 24 39 21 Q37 20 37 17 Z',
    detail: 'M47 31 a2.45 2.45 0 1 0 4.9 0 a2.45 2.45 0 1 0 -4.9 0',
  },
  ribbon: {
    bottomLip: true,
    material: 'teal',
    body: 'M30 26 Q18 13 9 13 Q4 13 5 22 L6 40 Q6 47 13 44 L25 38 L20 51 Q19 53 22 52 L28 50 L32 54 L35 40 L42 52 L45 47 L51 48 L43 38 Q55 46 58 41 Q60 38 59 21 Q60 10 52 13 L36 25 Z',
    darkAccent: true,
    accent: 'M26 26 Q26 22 31 22 H34 Q39 22 39 27 L38 35 Q38 39 33 39 H30 Q26 39 26 35 Z',
  },
  star: {
    bottomLip: true,
    material: 'amber',
    body: 'M29 9 Q32 3 35 9 L41 22 L56 24 Q62 25 57 30 L46 40 L49 54 Q50 61 44 58 L32 51 L19 58 Q13 61 15 54 L17 40 L6 30 Q2 25 8 24 L23 22 Z',
  },
  cookie: {
    bottomLip: true,
    material: 'amber',
    body: 'M45 8 Q45 17 54 17 Q51 27 60 29 C62 45 50 57 35 59 C19 61 5 50 5 34 C4 17 18 5 33 5 Q39 5 45 8 Z',
    darkAccent: true,
    accent: 'M20 20 q4 -3 7 1 l-1 5 q-4 2 -8 -1 Z M37 31 l6 -1 3 5 -4 4 -6 -2 Z M19 40 l5 -2 4 4 -2 5 -6 -1 Z',
  },
  parcel: {
    material: 'terracotta',
    body: 'M8 15 L50 12 Q53 12 55 16 L59 23 L58 48 Q58 51 55 52 L13 55 Q9 55 8 51 L5 22 Q5 17 8 15 Z',
    accent: 'M24 14 L32 14 L37 22 L37 35 L32 32 L28 36 L27 23 Z',
    line: 'M6 23 L58 20',
  },
  planting_tile: {
    bottomLip: true,
    material: 'terracotta',
    body: 'M12 33 Q12 31 15 31 L49 31 Q52 31 52 34 L51 39 L47 39 L44 55 Q44 58 40 58 L24 58 Q20 58 20 55 L17 39 L13 39 Z',
    accentMaterial: 'sage',
    accent: 'M30 34 L30 26 Q16 26 13 10 Q29 9 33 23 Q37 8 52 6 Q52 24 35 28 L34 34 Z',
  },
  carriage: {
    material: 'teal',
    body: 'M9 12 Q7 12 7 16 L7 43 Q7 47 11 47 L13 47 A6 6 0 1 0 25 48 L40 48 A6 6 0 1 0 52 47 L55 47 Q58 47 58 43 L58 17 Q58 12 53 12 Z',
    accent: 'M13 19 H29 V32 H13 Z M35 19 H52 V32 H35 Z',
  },
  book: {
    material: 'violet',
    body: 'M13 10 L46 6 Q50 5 51 10 L56 44 Q57 49 53 50 L20 57 Q13 59 10 52 L6 20 Q5 12 13 10 Z',
    accent: 'M15 47 L51 40 L53 47 L20 54 Q13 56 13 51 Q13 48 15 47 Z',
  },
  shell: {
    material: 'coral',
    body: 'M23 52 C16 48 6 39 5 31 Q4 23 10 22 Q10 15 18 15 Q21 7 29 11 Q36 5 42 12 Q51 10 53 18 Q60 19 59 28 Q63 36 55 42 L41 53 L42 57 Q33 61 23 57 Z',
    accent: 'M32 49 L14 24 L29 39 L25 16 L34 38 L39 16 L38 41 L52 26 L36 50 Z',
  },
  leaf: {
    material: 'sage',
    body: 'M12 46 C0 26 22 7 57 7 Q57 44 35 51 Q24 55 16 49 L9 57 Q6 60 5 56 Z',
    accent: 'M14 46 Q25 38 47 18 Q34 35 16 50 Z',
  },
  chair: {
    material: 'amber',
    body: 'M12 8 Q12 5 16 5 L44 5 Q48 5 48 9 L47 31 L53 35 Q55 36 54 39 L51 56 Q50 60 46 58 L46 41 L20 41 L17 57 Q16 60 12 58 L12 40 Q9 39 9 35 L12 31 Z',
    accent: 'M14 31 L45 30 L51 35 L13 37 Z',
  },
  guest: {
    material: 'teal',
    body: 'M32 6 C41 6 46 13 46 21 Q46 29 39 34 Q55 38 57 51 Q58 57 53 57 H11 Q6 57 7 51 Q9 38 25 34 Q18 30 18 21 Q18 7 32 6 Z',
    accentMaterial: 'terracotta',
    accent: 'M32 8 C40 8 44 14 44 21 C44 29 38 34 32 34 C25 34 20 29 20 21 Q20 8 32 8 Z',
  },
  plant: {
    bottomLip: true,
    material: 'sage',
    body: 'M29 45 L28 33 C14 32 8 23 8 13 C21 12 30 19 32 29 C32 14 42 6 55 6 Q55 27 35 32 L34 45 Z',
    accentMaterial: 'terracotta',
    accent: 'M14 37 Q14 35 17 35 H48 Q51 35 50 39 L46 54 Q45 58 41 58 H23 Q20 58 19 55 Z',
  },
  coin: {
    material: 'amber',
    body: coinRim,
    accent: coinCore,
    detail: 'M21 39 Q22 35 27 31 Q32 26 37 31 L42 37 Q47 46 38 45 Q32 42 26 45 Q18 47 21 39 Z M18 27 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0 M28 22 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 M39 27 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0',
  },
  euro: {
    material: 'amber',
    body: coinRim,
    accent: coinCore,
  },
  cent: {
    material: 'amber',
    body: coinRim,
    accent: coinCore,
  },
  ball: {
    material: 'teal',
    body: 'M32 5 A27 27 0 1 1 31.99 5 Z',
    accent: 'M22 8 Q47 23 53 48 Q46 56 36 58 Q43 29 19 9 Z',
  },
  box: {
    material: 'amber',
    body: 'M10 18 H54 L61 30 L54 33 V52 Q54 55 51 55 H13 Q10 55 10 52 V33 L3 30 Z',
    accent: 'M12 18 H52 L46 29 H18 Z',
    darkAccent: true,
  },
  apple: {
    material: 'coral',
    body: 'M31 18 Q30 11 34 6 L38 7 Q34 12 35 17 C45 11 57 17 58 30 C59 44 49 60 40 58 Q33 55 28 58 C16 61 5 43 6 29 Q8 12 23 15 Z',
    accentMaterial: 'sage',
    accent: 'M33 17 Q35 5 49 6 Q47 16 33 17 Z',
  },
  cup: {
    material: 'teal',
    body: 'M7 19 Q7 15 11 15 H42 Q46 15 46 19 V21 H51 C65 21 64 43 49 44 H44 Q40 55 31 55 H23 Q12 55 10 43 Z M46 27 V37 H49 C56 37 57 27 51 27 Z',
    line: 'M11 22 H41',
  },
  bag: {
    material: 'terracotta',
    body: 'M24 17 L19 7 Q24 4 30 9 Q36 3 44 7 L38 18 C42 24 55 33 56 44 Q59 57 45 58 H18 Q5 57 8 44 C10 33 21 23 24 17 Z',
    line: 'M23 18 Q31 21 40 17',
  },
  bottle: {
    material: 'teal',
    body: 'M25 6 H39 V18 C39 23 47 24 47 32 V54 Q47 59 42 59 H22 Q17 59 17 54 V32 C17 24 25 23 25 18 Z',
    accent: 'M25 4 H39 Q41 4 41 6 V12 H23 V6 Q23 4 25 4 Z',
    darkAccent: true,
  },
  balloon: {
    material: 'coral',
    body: 'M32 5 C45 5 54 15 53 28 C52 37 44 45 34 48 L37 52 L28 52 L30 48 C18 44 11 35 11 24 C11 13 20 5 32 5 Z',
    accent: 'M31 46 L34 46 L37 52 L28 52 Z',
    line: 'M32 50 C39 54 27 57 33 62',
  },
  cupcake: {
    material: 'amber',
    body: 'M10 31 H54 L49 54 Q48 57 44 57 H21 Q17 57 16 54 Z',
    accentMaterial: 'coral',
    accent: 'M9 34 Q4 29 10 23 Q9 18 16 16 Q19 8 27 11 Q29 3 36 6 Q41 7 42 13 Q52 11 53 20 Q62 24 57 32 Q53 38 47 34 Q41 41 34 35 Q27 40 21 35 Q15 39 9 34 Z',
  },
  cat: {
    material: 'amber',
    body: 'M9 29 L9 9 Q9 5 13 7 L27 17 Q32 15 39 17 L52 7 Q56 5 56 10 L55 31 Q61 42 54 49 Q46 57 32 57 Q17 57 10 50 Q3 42 9 29 Z',
    accent: 'M24 41 Q28 37 32 40 Q37 37 41 41 Q44 48 36 49 L30 49 Q21 50 24 41 Z',
    detail: 'M17 32 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 M42 32 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 M29 40 Q32 38 35 40 L32 44 Z',
  },
  toy: {
    material: 'violet',
    body: 'M18 28 Q8 27 9 18 Q10 10 17 10 Q24 9 27 16 Q32 14 38 16 Q41 8 49 10 Q57 12 56 20 Q55 27 48 29 Q54 36 53 44 Q51 57 32 57 Q14 57 11 45 Q9 35 18 28 Z',
    accent: 'M21 44 Q22 37 32 37 Q42 37 43 44 Q43 51 32 52 Q22 52 21 44 Z',
    detail: 'M20 31 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M41 31 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M28 41 Q32 39 36 41 L32 45 Z',
  },
};

export function glyphPaint(name: DiagramIconName, tone: DiagramIconTone) {
  const glyph = glyphs[name];
  if (tone === 'ghost') return { body: Shape.empty, edge: Shape.emptyEdge, lip: Shape.emptyLip, accent: Ink.tray, accentEdge: Shape.emptyEdge };
  if (name === 'euro') return tone === 'secondary'
    ? { body: Quantity.amber.fill, edge: Quantity.amber.onFill, lip: Quantity.amber.edge, accentEdge: Quantity.amber.onFill, accent: Ink.guide }
    : { body: Ink.guide, edge: Ink.soft, lip: Ink.soft, accentEdge: Ink.soft, accent: Quantity.amber.fill };
  const swapped = tone === 'secondary';
  const body = materials[swapped ? glyph.material === 'violet' ? 'teal' : 'violet' : glyph.material];
  const edge = 'onFill' in body ? body.onFill : body.edge;
  const accent = glyph.darkAccent ? edge : !swapped && glyph.accentMaterial ? materials[glyph.accentMaterial].fill : body.light;
  const accentEdge = !swapped && glyph.accentMaterial ? materials[glyph.accentMaterial].edge : edge;
  return { body: body.fill, accent, accentEdge, edge, lip: body.edge };
}
