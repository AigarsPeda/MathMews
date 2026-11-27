import { RouteGridSurface, ROUTE_CELL, ROUTE_GAP } from './RouteGridSurface';
import { useModelStage } from './kit/ModelStage';
import { BudgetPlanTask } from './BudgetPlanTask';
import { SortBucketsTask } from './SortBucketsTask';
import { DropTargetOutline } from '@/components/puzzle/kit/PracticeAffordances';
import { UnknownWell } from '@/components/puzzle/kit/PuzzleKit';
import { Announce } from "@/components/puzzle/tiles/Announce";
import { FeedbackTile, landTick, Pulse } from "@/components/puzzle/tiles/TileMotion";
import { HOP_LANE, HopArcs, PatternChip, PATTERN_GAP, patternDigitSize, patternStep, patternTileSize } from "@/components/puzzle/PatternNextTask";
import { RevealSurface } from "@/components/puzzle/kit/RevealSurface";
import { useRevealBeats } from "@/components/puzzle/kit/useRevealBeats";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Ink, Motion, PuzzleColors as GameColors, Quantity, Shape, Radius } from "@/constants/puzzle-theme";
import type { OptionalChallengePuzzle, RepairPatternPuzzle, RouteGridPuzzle } from "@/types/puzzle";
import { checkChallengeAnswer, getRouteValue, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { moderateScale } from "@/utils/scale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { numberTileFaces, PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from "@/components/puzzle/PuzzleDragBoard";
import { movePatternTile } from "@/utils/puzzle-drag";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

type Controls = { initialAnswer?: ChallengeAnswer | null; initialIndices?: readonly number[]; answered: boolean; onAnswerChange: (answer: ChallengeAnswer | null) => void; onDragStateChange: (dragging: boolean) => void };

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, pressed && !disabled && styles.actionPressed, disabled && styles.disabled]}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}

/**
 * The pattern sits on one baseline; each gap is an unknown well. Spare tiles
 * wait in a tray below. Drag a tile into a gap, or tap a tile and then a gap.
 * Placed tiles land; after Check the row pops (or misplaced tiles shake).
 */
function RepairPatternTask({ puzzle, initialAnswer, answered, onAnswerChange, onDragStateChange }: Controls & { puzzle: RepairPatternPuzzle }) {
  const { t } = useTranslation();
  const { sequence, tiles, solution } = puzzle.payload;
  const [placements, setPlacements] = useState<(number | null)[]>(() => {
    const gaps = sequence.filter(value => value === null);
    if (initialAnswer?.kind !== 'sequence') return gaps.map(() => null);
    const used = new Set<number>();
    return gaps.map((_, slot) => {
      const tile = tiles.findIndex((value, index) => value === initialAnswer.values[slot] && !used.has(index));
      if (tile < 0) return null;
      used.add(tile);
      return tile;
    });
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [moved, setMoved] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const handleDrag = useCallback((active: boolean) => {
    setDragging(active);
    onDragStateChange(active);
  }, [onDragStateChange]);
  const gapActive = !answered && (dragging || picked !== null);
  const answer = useMemo<ChallengeAnswer | null>(() => placements.some(n => n === null) ? null : { kind: "sequence", values: placements.map(i => tiles[i!]) }, [placements, tiles]);
  useEffect(() => onAnswerChange(answer), [answer, onAnswerChange]);
  const tileCount = tiles.length, gapCount = placements.length;
  const drop = useCallback((source: string, target: string) => {
    const tile = Number(source), slot = target === "bank" ? null : Number(target.replace("gap-", ""));
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileCount || (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= gapCount))) return;
    landTick();
    setPicked(null);
    setMoved(tile);
    setPlacements(current => movePatternTile(current, tile, slot));
  }, [gapCount, tileCount]);
  const gapPositions = sequence.flatMap((n, i) => n === null ? [i + 1] : []);
  const actions = [{ id: "bank", label: t("challenges.returnToBank") }, ...gapPositions.map((position, i) => ({ id: `gap-${i}`, label: t("challenges.placeInGap", { position }) }))];
  const solved = answered && answer !== null && checkChallengeAnswer(puzzle, answer);
  // Tapping a tile while another is picked up puts the picked one where the tapped one is.
  function tapTile(index: number) {
    if (picked === null || picked === index) { setPicked(current => current === index ? null : index); return; }
    const slot = placements.indexOf(index);
    if (slot >= 0) drop(String(picked), `gap-${slot}`); else setPicked(index);
  }
  function tile(index: number, slot?: number) {
    const position = slot === undefined ? undefined : gapPositions[slot];
    const result = !answered || slot === undefined ? null : tiles[index] === solution[slot] ? (solved ? "correct" as const : null) : "wrong" as const;
    return <FeedbackTile key={index} result={result} delay={solved && slot !== undefined ? slot * Motion.tap : 0}>
      <PuzzleDragTile id={String(index)} label={String(tiles[index])} disabled={answered}
        face={<Text maxFontSizeMultiplier={1.4} style={[styles.number, faceText]}>{tiles[index]}</Text>}
        selected={picked === index} onPress={() => tapTile(index)}
        style={[picked === index ? styles.tileLifted : styles.tileResting, face, slot !== undefined && styles.placedTile]}
        accessibilityLabel={position === undefined ? t("challenges.numberTile", { number: tiles[index] }) : t("challenges.patternSlot", { number: position, value: tiles[index] })}
        accessibilityHint={t("challenges.tapOrDragHint")} actions={actions} />
    </FeedbackTile>;
  }
  let hole = -1;
  const pickedPlaced = picked !== null && placements.includes(picked);
  // Draw the shared hop diagram only on a solved sequence.
  const full = useMemo(() => { let k = 0; return sequence.map(v => v ?? solution[k++]); }, [sequence, solution]);
  const step = solved ? patternStep(full) : null;
  const beats = useRevealBeats(solved && step ? sequence.length - 1 : 0);
  const { width: screen, fontScale } = useWindowDimensions();
  const digits = Math.max(...[...full, ...tiles].map(value => String(value).length));
  // One tile size and 4 pt gap for the entry row, the bank and the proof, so the answer tiles fill their slots exactly.
  const size = patternTileSize(screen, sequence.length);
  const rowWidth = sequence.length * size + (sequence.length - 1) * PATTERN_GAP;
  const faceText = { fontSize: patternDigitSize(size, digits, fontScale), lineHeight: patternDigitSize(size, digits, fontScale) * 1.25 };
  const slotStyle = styles.patternSlot;
  const face = { width: size, minWidth: size, height: size, minHeight: size, borderRadius: Shape.tile(size) };
  return <View style={styles.wrap}>
    <PuzzleDragBoard floatingStyle={numberTileFaces.lifted} onDrop={drop} onDragStateChange={handleDrag}>
      <RevealSurface beats={beats} replayable={solved && !!step}>
      <View style={{ width: rowWidth, alignSelf: "center" }}>
      {/* The hop lane is reserved in every state, so the row sits at the same y as in the proof. */}
      <HopArcs slots={sequence.length} width={rowWidth} beats={beats} step={step} solved={solved} />
      <View style={styles.sequence}>{sequence.map((value, i) => {
        if (value !== null) return <View key={i} style={slotStyle}><Pulse when={solved && !!step && beats.landed === i && i > 0}><PatternChip label={String(value)} tile={size} digits={digits} fontScale={fontScale} /></Pulse></View>;
        const slot = ++hole, placed = placements[slot];
        return <View key={i} style={slotStyle}><PuzzleDropArea fillOnly={placed === null} id={`gap-${slot}`} label={t("challenges.patternSlot", { number: i + 1, value: placed === null ? t("challenges.empty") : tiles[placed] })}>
          {placed === null
            ? <Pressable disabled={answered || picked === null} onPress={() => picked !== null && drop(String(picked), `gap-${slot}`)} accessibilityRole="button"
              accessibilityLabel={t("challenges.placeInGap", { position: i + 1 })} accessibilityState={{ disabled: answered || picked === null }}>
              {gapActive ? <DropTargetOutline active style={face}><Text maxFontSizeMultiplier={1.4} style={[styles.number, faceText]}>?</Text></DropTargetOutline>
                : <UnknownWell size="lg" style={[face, styles.emptyGap]} />}
            </Pressable>
            : tile(placed, slot)}
        </PuzzleDropArea></View>;
      })}</View>
      <View style={{ height: HOP_LANE }} />
      </View>
      </RevealSurface>

      <Announce trigger={`${picked}|${placements.join(",")}`} message={picked !== null ? t("challenges.pickedTile", { value: tiles[picked] })
        : moved === null ? null : placements.includes(moved) ? t("challenges.patternSlot", { number: gapPositions[placements.indexOf(moved)], value: tiles[moved] })
          : t("challenges.sortTile", { value: tiles[moved], group: t("challenges.unplaced") })} />
      <PuzzleDropArea id="bank" label={t("challenges.tileBank")} style={styles.patternBank}>
        <View style={styles.tiles}>
          {tiles.flatMap((_, i) => placements.includes(i) ? [] : [tile(i)])}
          {pickedPlaced && !answered ? <Pressable onPress={() => drop(String(picked), "bank")} accessibilityRole="button" accessibilityLabel={t("challenges.returnToBank")}>
            <DropTargetOutline active style={face}><Text style={styles.number}>+</Text></DropTargetOutline>
          </Pressable> : null}
        </View>
      </PuzzleDropArea>
    </PuzzleDragBoard>
  </View>;
}

function RouteGridTask({ puzzle, initialAnswer, answered, onAnswerChange }: Controls & { puzzle: RouteGridPuzzle }) {
  const { t } = useTranslation();
  useModelStage();
  const { cells, columns, moves, start } = puzzle.payload;
  const [path, setPath] = useState<number[]>(() => initialAnswer?.kind === 'route' ? [...initialAnswer.cells] : [0]);
  const [gridWidth, setGridWidth] = useState(0);
  const value = getRouteValue(puzzle, path)!;
  const current = path.at(-1)!;
  const answer = useMemo<ChallengeAnswer | null>(() => path.length === moves + 1 && path.at(-1) === cells.length - 1 ? { kind: "route", cells: path } : null, [path, moves, cells.length]);
  useEffect(() => onAnswerChange(answer), [answer, onAnswerChange]);
  const exit = cells.length - 1;
  const solved = answered && answer !== null && checkChallengeAnswer(puzzle, answer);
  // Screen readers move from the current square to a named neighbour, or undo, without hunting for cells.
  const cellLabel = (index: number) => index === 0 ? t("challenges.startValue", { value: start }) : `${cells[index]!.operator === "-" ? "−" : cells[index]!.operator}${cells[index]!.operand}`;
  const neighbours = answered ? [] : ([["Up", -columns], ["Down", columns], ["Left", -1], ["Right", 1]] as const).flatMap(([direction, delta]) => {
    const index = current + delta;
    if (index < 0 || index >= cells.length || ((direction === "Left" || direction === "Right") && Math.floor(index / columns) !== Math.floor(current / columns))) return [];
    return getRouteValue(puzzle, [...path, index]) === null ? [] : [{ name: `move${direction}-${index}`, index,
      label: t(`challenges.routeMove${direction}`, { value: cellLabel(index), defaultValue: `Move ${direction.toLowerCase()}: {{value}}` }) }];
  });
  const routeActions = [...neighbours.map(({ name, label }) => ({ name, label })), ...(!answered && path.length > 1 ? [{ name: "undo", label: t("challenges.undoStep") }] : [])];
  const onRouteAction = (name: string) => {
    if (name === "undo") { setPath(path.slice(0, -1)); return; }
    const move = neighbours.find(n => n.name === name);
    if (move) { landTick(); setPath([...path, move.index]); }
  };
  return <View style={styles.wrap}>
    <Announce trigger={path.join(',')} message={t("challenges.routeStatus", { value, count: path.length - 1, total: moves })} />
    <View testID="play-entry-model" nativeID="play-entry-model" onLayout={e => setGridWidth(e.nativeEvent.layout.width)} style={[styles.grid, { alignSelf: "stretch" }]}>
      <RouteGridSurface width={gridWidth} columns={columns} count={cells.length} path={path} miss={answered && !solved} />
      {Array.from({ length: Math.ceil(cells.length / columns) }, (_, row) => <View key={row} style={styles.gridRow}>{cells.slice(row * columns, (row + 1) * columns).map((step, col) => {
        const index = row * columns + col;
        const next = [...path, index];
        const canMove = !answered && getRouteValue(puzzle, next) !== null;
        const label = cellLabel(index);
        const visited = path.indexOf(index);
        const isExit = index === exit;
        return <Pulse key={index} when={current === index && path.length > 1} style={styles.cellWrap}>
          <Pressable testID={canMove ? `route-choice-${index}` : `route-cell-${index}`} disabled={!canMove} onPress={() => { landTick(); setPath(next); }} accessibilityRole="button"
            accessibilityLabel={t("challenges.routeCell", { row: row + 1, column: col + 1, value: current === index && index !== 0 ? `${label} = ${value}` : label, state: current === index ? t("challenges.current") : visited >= 0 ? t("challenges.visited") : canMove ? t("challenges.available") : t("challenges.unavailable") })}
            accessibilityState={{ disabled: !canMove && current !== index, selected: current === index }}
            accessibilityHint={canMove ? t("challenges.routeInstructions") : undefined}
            accessibilityActions={current === index ? routeActions : undefined}
            onAccessibilityAction={current === index ? e => onRouteAction(e.nativeEvent.actionName) : undefined}
            style={({ pressed }) => [styles.gridCell, pressed && styles.actionPressed]}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={[styles.number, styles.routeNumber, !canMove && visited < 0 && !isExit && styles.mutedNumber]}>{index === current ? value : index === 0 ? start : label}</Text>
          </Pressable>
        </Pulse>;
      })}</View>)}
    </View>
    {!answered && path.length > 1 && <Action label={t("challenges.undoStep")} disabled={answered} onPress={() => setPath(path.slice(0, -1))} />}
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
  wrap: { gap: moderateScale(10) },
  caption: { fontSize: moderateScale(17), lineHeight: moderateScale(23), color: Ink.soft, textAlign: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: PATTERN_GAP },
  sequence: { flexDirection: "row", alignItems: "center", gap: PATTERN_GAP },
  patternSlot: { alignItems: "center" },
  emptyGap: { backgroundColor: Quantity.amber.light, borderBottomWidth: Shape.lip, borderBottomColor: Quantity.amber.fill },
  // The child's tiles are violet in the bank, in the row and in the proof; a picked one lifts. Amber only flags a wrong tile after a miss.
  tileResting: { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.fill },
  tileLifted: { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.fill, transform: [{ translateY: -6 }] },
  placedTile: { paddingHorizontal: 0 },
  number: { fontSize: moderateScale(22), fontWeight: "800", color: Ink.text, textAlign: "center", fontVariant: ["tabular-nums"] },
  mutedNumber: { color: Ink.soft },
  // Spare tiles wait in the bank until a gap can accept them.
  patternBank: { minHeight: moderateScale(84), padding: moderateScale(10), justifyContent: "center", borderRadius: Radius.tray, backgroundColor: Ink.tray },
  grid: { gap: ROUTE_GAP, position: "relative" },
  gridRow: { flexDirection: "row", gap: ROUTE_GAP },
  cellWrap: { flex: 1 },
  gridCell: { height: ROUTE_CELL, alignItems: "center", justifyContent: "center" },
  routeNumber: { alignSelf: "stretch", textAlign: "center", textAlignVertical: "center", includeFontPadding: false, fontSize: moderateScale(28), lineHeight: moderateScale(34), paddingHorizontal: 12 },
  gridLabel: { fontSize: moderateScale(14), lineHeight: moderateScale(18), fontWeight: "700", color: Ink.soft, textAlign: "center" },
  currentLabel: { color: GameColors.primaryDark },
  action: { alignSelf: "center", minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  actionPressed: { opacity: 0.7 },
  actionText: { fontSize: moderateScale(17), fontWeight: "800", color: GameColors.primaryDark, textAlign: "center" }, disabled: { opacity: 0.4 },
});
