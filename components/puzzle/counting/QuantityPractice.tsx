import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { EntryBuild } from '../kit/PracticeAffordances';

function newPractice() {
  const snapshot = {entryShown: false, insets: new Map<string, number>(), transferSizes: new Map<string, number>(), transfers: 0, coveredSquares: new Set<number>(), tracedEdges: 0, rows: new Set<number>(), locations: [] as number[], shareSlots: [] as number[]};
  return {
    snapshot,
    markEntryShown() { snapshot.entryShown = true; },
    saveCoveredSquares(cells: Set<number>) { snapshot.coveredSquares = cells; },
    saveTracedEdges(count: number) { snapshot.tracedEdges = count; },
    saveTransfers(count: number) { snapshot.transfers = count; },
    saveRows(rows: Set<number>) { snapshot.rows = rows; },
    saveDeal(locations: number[], slots: number[]) { snapshot.locations = locations; snapshot.shareSlots = slots; },
  };
}
const Practice = createContext<ReturnType<typeof newPractice> | null>(null);

/** Play keys this provider by puzzle. Editor, retry and replay read the same submitted model. */
export function QuantityPracticeProvider({ children }: { children: ReactNode }) {
  const [practice] = useState(newPractice);
  return <Practice.Provider value={practice}>{children}</Practice.Provider>;
}
export function useQuantityPractice() {
  const provided = useContext(Practice);
  const [local] = useState(newPractice);
  return provided ?? local;
}

/** A retry may remount the editor for the same puzzle. Keep its drawing at full size. */
export function QuantityEntryBuild({ editing, ready, children }: { editing: boolean; ready: boolean; children: ReactNode }) {
  const practice = useQuantityPractice();
  const [build] = useState(() => editing && !practice.snapshot.entryShown);
  useEffect(() => {
    if (build && ready) practice.markEntryShown();
  }, [build, ready, practice]);
  return build ? <EntryBuild ready={ready}>{children}</EntryBuild> : <>{children}</>;
}

const encountered = new Set<string>();
export function useFirstQuantityEncounter(mechanic: string, enabled: boolean) {
  const [first] = useState(() => !encountered.has(mechanic));
  useEffect(() => { if (enabled) encountered.add(mechanic); }, [enabled, mechanic]);
  return first;
}
