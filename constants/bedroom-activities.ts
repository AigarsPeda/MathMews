/** Human beds and bedroom doubles share mattress and quilt interactions. */
export function isSleepingBed(id: string): boolean {
  return id === 'bedroomDoubleBed' || id === 'bedroomBedRose' || id === 'bedroomBedLilac' || /^bed-house[A-G]$/.test(id);
}
export type BedPhase = 'crawl' | 'covered' | 'uncover';
