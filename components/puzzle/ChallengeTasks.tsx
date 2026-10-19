import { GameColors } from "@/constants/game";
import type { BudgetPlanPuzzle, OptionalChallengePuzzle, RepairPatternPuzzle, RouteGridPuzzle, SortBucketsPuzzle } from "@/types/puzzle";
import { getRouteValue, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { moderateScale } from "@/utils/scale";
import { useCallback, useState } from "react";
import { PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from "@/components/puzzle/PuzzleDragBoard";
import { movePatternTile } from "@/utils/puzzle-drag";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Controls = { answered: boolean; onSubmit: (answer: ChallengeAnswer) => void; onDragStateChange: (dragging: boolean) => void };

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}

function SortBucketsTask({ puzzle, answered, onSubmit, onDragStateChange }: Controls & { puzzle: SortBucketsPuzzle }) {
  const { t } = useTranslation();
  const p = puzzle.payload;
  const labels = p.rule === "range" ? p.numbers.map(String) : p.fractions.map(([n, d]) => `${n}/${d}`);
  const buckets = p.rule === "range"
    ? [t("challenges.lessThan", { number: p.boundary }), t("challenges.atLeast", { number: p.boundary })]
    : p.targets.map(([n, d]) => `${n}/${d}`);
  const [assignments, setAssignments] = useState<number[]>(() => labels.map(() => -1));
  const tileCount = labels.length, bucketCount = buckets.length;
  const drop = useCallback((source: string, target: string) => {
    const tile = Number(source), bucket = target === "bank" ? -1 : Number(target.replace("bucket-", ""));
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileCount || !Number.isInteger(bucket) || bucket < -1 || bucket >= bucketCount) return;
    setAssignments(current => current.map((value, i) => i === tile ? bucket : value));
  }, [tileCount, bucketCount]);
  const actions = [{ id: "bank", label: t("challenges.returnToBank") }, ...buckets.map((group, i) => ({ id: `bucket-${i}`, label: t("challenges.placeIn", { group }) }))];
  function tile(index: number, compact = false) {
    return <PuzzleDragTile key={index} id={String(index)} label={labels[index]} disabled={answered} compact={compact}
      accessibilityLabel={t("challenges.sortTile", { value: labels[index], group: assignments[index] < 0 ? t("challenges.unplaced") : buckets[assignments[index]] })}
      accessibilityHint={t("challenges.dragA11yHint")} actions={actions} />;
  }
  return <View style={styles.wrap}>
    <Text style={styles.instructions}>{t("challenges.sortInstructions")}</Text>
    <Text style={styles.status} accessibilityLiveRegion="polite">{t("challenges.sortedCount", { count: assignments.filter(n => n >= 0).length, total: labels.length })}</Text>
    <PuzzleDragBoard onDrop={drop} onDragStateChange={onDragStateChange}>
      <PuzzleDropArea id="bank" label={t("challenges.tileBank")} style={styles.sortBank}>
        <View style={styles.tiles}>{labels.flatMap((_, i) => assignments[i] < 0 ? [tile(i)] : [])}</View>
        {assignments.every(n => n >= 0) && <Text style={styles.instructions}>{t("challenges.returnHere")}</Text>}
      </PuzzleDropArea>
      <View style={styles.buckets}>{buckets.map((label, bucket) => <PuzzleDropArea key={bucket} id={`bucket-${bucket}`} label={label} style={styles.bucket}>
        <Text style={styles.bucketTitle}>{label}</Text>
        <View style={styles.bucketTiles}>{labels.flatMap((_, i) => assignments[i] === bucket ? [tile(i, true)] : [])}</View>
        {!assignments.includes(bucket) && <Text style={styles.groupItems}>{t("challenges.emptyGroup")}</Text>}
      </PuzzleDropArea>)}</View>
    </PuzzleDragBoard>
    <Action label={t("challenges.checkSorting")} disabled={answered || assignments.some(n => n < 0)} onPress={() => onSubmit({ kind: "sort", buckets: assignments })} />
  </View>;
}

function RepairPatternTask({ puzzle, answered, onSubmit, onDragStateChange }: Controls & { puzzle: RepairPatternPuzzle }) {
  const { t } = useTranslation();
  const { sequence, tiles } = puzzle.payload;
  const [placements, setPlacements] = useState<(number | null)[]>(() => sequence.filter(n => n === null).map(() => null));
  const tileCount = tiles.length, gapCount = placements.length;
  const drop = useCallback((source: string, target: string) => {
    const tile = Number(source), slot = target === "bank" ? null : Number(target.replace("gap-", ""));
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileCount || (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= gapCount))) return;
    setPlacements(current => movePatternTile(current, tile, slot));
  }, [gapCount, tileCount]);
  const gapPositions = sequence.flatMap((n, i) => n === null ? [i + 1] : []);
  const actions = [{ id: "bank", label: t("challenges.returnToBank") }, ...gapPositions.map((position, i) => ({ id: `gap-${i}`, label: t("challenges.placeInGap", { position }) }))];
  function tile(index: number, position?: number) {
    return <PuzzleDragTile key={index} id={String(index)} label={String(tiles[index])} disabled={answered}
      accessibilityLabel={position === undefined ? t("challenges.numberTile", { number: tiles[index] }) : t("challenges.patternSlot", { number: position, value: tiles[index] })}
      accessibilityHint={t("challenges.dragA11yHint")} actions={actions} />;
  }
  let hole = -1;
  return <View style={styles.wrap}>
    <Text style={styles.instructions}>{t("challenges.patternInstructions")}</Text>
    <PuzzleDragBoard onDrop={drop} onDragStateChange={onDragStateChange}>
      <View style={styles.tiles}>{sequence.map((value, i) => {
        if (value !== null) return <View key={i} style={[styles.tile, styles.fixed]}><Text style={styles.number}>{value}</Text></View>;
        const slot = ++hole, placed = placements[slot];
        return <PuzzleDropArea key={i} id={`gap-${slot}`} label={t("challenges.patternSlot", { number: i + 1, value: placed === null ? t("challenges.empty") : tiles[placed] })}>
          {placed === null ? <View style={[styles.tile, styles.hole]}><Text style={styles.number}>?</Text></View> : tile(placed, i + 1)}
        </PuzzleDropArea>;
      })}</View>
      <Text style={styles.instructions}>{t("challenges.spareTiles")}</Text>
      <PuzzleDropArea id="bank" label={t("challenges.tileBank")} style={styles.patternBank}>
        <View style={styles.tiles}>{tiles.flatMap((_, i) => placements.includes(i) ? [] : [tile(i)])}</View>
      </PuzzleDropArea>
    </PuzzleDragBoard>
    <Action label={t("challenges.checkPattern")} disabled={answered || placements.some(n => n === null)} onPress={() => onSubmit({ kind: "sequence", values: placements.map(i => tiles[i!]) })} />
  </View>;
}

function RouteGridTask({ puzzle, answered, onSubmit }: Controls & { puzzle: RouteGridPuzzle }) {
  const { t } = useTranslation();
  const { cells, columns, moves, start, target } = puzzle.payload;
  const [path, setPath] = useState<number[]>([0]);
  const value = getRouteValue(puzzle, path)!;
  const current = path.at(-1)!;
  return <View style={styles.wrap}>
    <Text style={styles.instructions}>{t("challenges.routeInstructions")}</Text>
    <Text style={styles.goal}>{t("challenges.routeGoal", { target, moves })}</Text>
    <Text style={styles.status} accessibilityLiveRegion="polite">{t("challenges.routeStatus", { value, count: path.length - 1, total: moves })}</Text>
    {Array.from({ length: Math.ceil(cells.length / columns) }, (_, row) => <View key={row} style={styles.gridRow}>{cells.slice(row * columns, (row + 1) * columns).map((step, col) => {
      const index = row * columns + col;
      const next = [...path, index];
      const canMove = !answered && getRouteValue(puzzle, next) !== null;
      const label = index === 0 ? t("challenges.startValue", { value: start }) : `${step!.operator === "-" ? "−" : step!.operator}${step!.operand}`;
      const visited = path.indexOf(index);
      return <Pressable key={index} disabled={!canMove} onPress={() => setPath(next)} accessibilityRole="button"
        accessibilityLabel={t("challenges.routeCell", { row: row + 1, column: col + 1, value: label, state: current === index ? t("challenges.current") : visited >= 0 ? t("challenges.visited") : canMove ? t("challenges.available") : t("challenges.unavailable") })}
        accessibilityState={{ disabled: !canMove, selected: current === index }}
        style={[styles.gridCell, visited >= 0 && styles.placed, current === index && styles.selected, !canMove && visited < 0 && styles.unavailable]}>
        <Text style={styles.gridLabel}>{index === 0 ? t("challenges.start") : index === cells.length - 1 ? t("challenges.exit") : visited >= 0 ? t("challenges.step", { number: visited }) : ""}</Text>
        <Text style={styles.number}>{index === 0 ? start : label}</Text>
      </Pressable>;
    })}</View>)}
    <Action label={t("challenges.undoStep")} disabled={answered || path.length < 2} onPress={() => setPath(path.slice(0, -1))} />
    <Action label={t("challenges.checkRoute")} disabled={answered || path.length !== moves + 1 || current !== cells.length - 1} onPress={() => onSubmit({ kind: "route", cells: path })} />
  </View>;
}

function BudgetPlanTask({ puzzle, answered, onSubmit }: Controls & { puzzle: BudgetPlanPuzzle }) {
  const { t } = useTranslation();
  const { budget, remaining, pickCount, items } = puzzle.payload;
  const [selected, setSelected] = useState<number[]>([]);
  return <View style={styles.wrap}>
    <Text style={styles.goal}>{t("challenges.budgetGoal", { budget, remaining, count: pickCount })}</Text>
    <Text style={styles.instructions}>{t("challenges.budgetInstructions")}</Text>
    <Text style={styles.status} accessibilityLiveRegion="polite">{t("challenges.itemsSelected", { count: selected.length, total: pickCount })}</Text>
    {items.map((item, i) => <Pressable key={i} disabled={answered} onPress={() => setSelected(current => current.includes(i) ? current.filter(n => n !== i) : [...current, i])}
      accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(i), disabled: answered }} style={[styles.shopItem, selected.includes(i) && styles.selected]}>
      <View style={styles.itemHeading}><Text style={styles.itemTitle}>{item.label}</Text><Text style={styles.price}>{t("challenges.price", { price: item.price })}</Text></View>
      <Text style={styles.instructions}>{item.discountPercent ? t("challenges.discount", { percent: item.discountPercent }) : t("challenges.noDiscount")}</Text>
    </Pressable>)}
    <Action label={t("challenges.checkPlan")} disabled={answered || selected.length !== pickCount} onPress={() => onSubmit({ kind: "budget", indices: selected })} />
  </View>;
}

export function ChallengeTask({ puzzle, ...controls }: Controls & { puzzle: OptionalChallengePuzzle }) {
  switch (puzzle.type) {
    case "sort_buckets": return <SortBucketsTask puzzle={puzzle} {...controls} />;
    case "repair_pattern": return <RepairPatternTask puzzle={puzzle} {...controls} />;
    case "route_grid": return <RouteGridTask puzzle={puzzle} {...controls} />;
    case "budget_plan": return <BudgetPlanTask puzzle={puzzle} {...controls} />;
  }
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(16) },
  instructions: { fontSize: moderateScale(15), lineHeight: moderateScale(22), color: GameColors.text },
  status: { fontSize: moderateScale(16), fontWeight: "700", color: "#5D408C", textAlign: "center" },
  goal: { fontSize: moderateScale(20), fontWeight: "800", color: GameColors.text, textAlign: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: moderateScale(10) },
  tile: { minWidth: moderateScale(64), minHeight: moderateScale(60), padding: moderateScale(12), borderRadius: moderateScale(14), borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, justifyContent: "center", alignItems: "center" },
  number: { fontSize: moderateScale(23), fontWeight: "800", color: GameColors.text, textAlign: "center" },
  placed: { backgroundColor: "#E8FAF8" }, selected: { backgroundColor: "#E8FAF8", borderColor: GameColors.secondaryDark },
  fixed: { backgroundColor: GameColors.background, borderColor: GameColors.background }, hole: { borderStyle: "dashed", borderColor: "#5D408C" },
  sortBank: { minHeight: moderateScale(144), padding: moderateScale(6), justifyContent: "center" },
  patternBank: { minHeight: moderateScale(76), padding: moderateScale(6), justifyContent: "center" },
  bucketTiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: moderateScale(6) },
  buckets: { flexDirection: "row", gap: moderateScale(12) },
  bucket: { flex: 1, minHeight: moderateScale(120), borderWidth: 2, borderColor: "#BBA4E6", borderRadius: moderateScale(14), padding: moderateScale(12), gap: moderateScale(12), backgroundColor: "#F3EEFF" },
  bucketTitle: { fontSize: moderateScale(17), fontWeight: "800", color: "#5D408C", textAlign: "center" },
  groupItems: { fontSize: moderateScale(17), lineHeight: moderateScale(26), color: GameColors.text, textAlign: "center" },
  gridRow: { flexDirection: "row", gap: moderateScale(10) },
  gridCell: { flex: 1, minHeight: moderateScale(80), padding: moderateScale(8), borderRadius: moderateScale(14), borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, justifyContent: "center", gap: moderateScale(4) },
  gridLabel: { fontSize: moderateScale(12), color: GameColors.text, textAlign: "center" }, unavailable: { backgroundColor: GameColors.background },
  action: { minHeight: moderateScale(50), padding: moderateScale(12), borderRadius: moderateScale(14), backgroundColor: "#5D408C", alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: moderateScale(17), fontWeight: "800", color: GameColors.card, textAlign: "center" }, disabled: { opacity: 0.5 },
  shopItem: { minHeight: moderateScale(70), padding: moderateScale(14), borderRadius: moderateScale(14), borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, gap: moderateScale(6) },
  itemHeading: { flexDirection: "row", gap: moderateScale(12), alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  itemTitle: { flexShrink: 1, fontSize: moderateScale(18), fontWeight: "800", color: GameColors.text }, price: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.coinText },
});
