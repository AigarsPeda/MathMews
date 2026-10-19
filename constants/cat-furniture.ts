import furniture from '@/constants/cat-furniture-surfaces.json';

type FurnitureSurface = { min: number[]; max: number[]; footprint: number[][] };
export type CatFurniture = { front: number; allSides: boolean; surfaces: FurnitureSurface[] };
export const CAT_FURNITURE: Record<string, CatFurniture> = furniture;
export function isFurniturePerch(id: string): boolean {
  return !!CAT_FURNITURE[id];
}
