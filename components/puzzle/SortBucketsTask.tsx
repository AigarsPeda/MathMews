import { FractionStrip } from '@/components/puzzle/fraction/FractionStrip';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats, type RevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { numberTileFaces, PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea, PuzzleDropSlot, TileLabel } from '@/components/puzzle/PuzzleDragBoard';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Announce } from '@/components/puzzle/tiles/Announce';
import { FeedbackTile, landTick } from '@/components/puzzle/tiles/TileMotion';
import { Ink, ProofMotion, Quantity, Radius } from '@/constants/puzzle-theme';
import type { SortBucketsPuzzle } from '@/types/puzzle';
import { checkChallengeAnswer, getSortBucket, type ChallengeAnswer } from '@/utils/challenge-puzzles';
import { moderateScale } from '@/utils/scale';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

/** Fraction tiles: 56 × 64 pt with 22 pt digits, the same size in the tray, the buckets and the proof. */
const SORT_W = 56, SORT_H = 64, SORT_DIGITS = 22;
// One tile colour in every state: teal. Amber only flags the misplaced tile after a miss; a picked tile lifts and turns violet.
const sortRest = { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.teal.edge, backgroundColor: Quantity.teal.fill };
const sortTile = { minWidth: SORT_W, minHeight: SORT_H, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14 };

type SortAnswer = Extract<ChallengeAnswer, { kind: 'sort' }>;
type Controls = {
  initialAnswer?: ChallengeAnswer | null;
  answered: boolean;
  onAnswerChange: (answer: ChallengeAnswer | null) => void;
  onDragStateChange: (dragging: boolean) => void;
};

function SortedTile({ activeBeat, beats, label, offset, mismatch }: {
  activeBeat: number; beats: RevealBeats; label: string; offset: number; mismatch: boolean;
}) {
  const motion = useAnimatedStyle(() => {
    const phase = Math.min(1, Math.max(0, beats.position.value - activeBeat));
    return { transform: [{ translateY: beats.reduced || mismatch ? 0 : -offset * Math.sin(Math.PI * phase) }] };
  });
  return <Animated.View style={[styles.proofCard, motion, mismatch && styles.mismatch]}>
    <TileLabel label={label} size={SORT_DIGITS} />
  </Animated.View>;
}

export function SortBucketsTask({ puzzle, initialAnswer, answered, onAnswerChange, onDragStateChange, proof }: Controls & {
  puzzle: SortBucketsPuzzle; proof?: { beats: RevealBeats; indices: number[]; mismatch: number };
}) {
  const { t } = useTranslation();
  const p = puzzle.payload;
  const labels = p.rule === "range" ? p.numbers.map(String) : p.fractions.map(([n, d]) => `${n}/${d}`);
  const buckets = p.rule === "range"
    ? [t("challenges.lessThan", { number: p.boundary }), t("challenges.atLeast", { number: p.boundary })]
    : p.targets.map(([n, d]) => `${n}/${d}`);
  const [assignments, setAssignments] = useState<number[]>(() =>
    initialAnswer?.kind === 'sort' ? [...initialAnswer.buckets] : labels.map(() => -1)
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [moved, setMoved] = useState<number | null>(null);
  const [tileRows, setTileRows] = useState<Record<number, number>>({});
  const answer: SortAnswer | null = assignments.some(n => n < 0) ? null : { kind: "sort", buckets: assignments };
  const tileCount = labels.length, bucketCount = buckets.length;
  const drop = useCallback((source: string, target: string) => {
    const tile = Number(source), bucket = target === "bank" ? -1 : Number(target.replace("bucket-", ""));
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileCount || !Number.isInteger(bucket) || bucket < -1 || bucket >= bucketCount) return;
    landTick();
    setPicked(null);
    setMoved(tile);
    const next = assignments.map((value, i) => i === tile ? bucket : value);
    setAssignments(next);
    onAnswerChange(next.some(n => n < 0) ? null : { kind: "sort", buckets: next });
  }, [tileCount, bucketCount, assignments, onAnswerChange]);
  const actions = [{ id: "bank", label: t("challenges.returnToBank") }, ...buckets.map((group, i) => ({ id: `bucket-${i}`, label: t("challenges.placeIn", { group }) }))];
  const solved = answered && answer !== null && checkChallengeAnswer(puzzle, answer);
  function tile(index: number, order = 0) {
    const placed = assignments[index] >= 0;
    const result = !answered || !placed ? null : getSortBucket(puzzle, index) === assignments[index] ? (solved ? "correct" as const : null) : "wrong" as const;
    if (proof) return <View key={index} onLayout={e => {
      const y = e.nativeEvent.layout.y;
      setTileRows(old => old[index] === y ? old : { ...old, [index]: y });
    }}>
      <SortedTile activeBeat={proof.indices.includes(index) ? proof.indices.indexOf(index) : Infinity}
        beats={proof.beats} label={labels[index]} offset={(tileRows[index] ?? 0) + 28} mismatch={index === proof.mismatch} />
    </View>;
    return <FeedbackTile key={index} result={result} delay={solved ? order * ProofMotion.countStride : 0}>
      <PuzzleDragTile id={String(index)} label={labels[index]} disabled={answered}
        face={<TileLabel label={labels[index]} size={SORT_DIGITS} selected={picked === index && !answered} />}
        selected={picked === index} onPress={() => setPicked(current => current === index ? null : index)}
        style={[sortTile, picked === index ? numberTileFaces.lifted : sortRest]}
        accessibilityLabel={t("challenges.sortTile", { value: labels[index], group: assignments[index] < 0 ? t("challenges.unplaced") : buckets[assignments[index]] })}
        accessibilityHint={t("challenges.tapOrDragHint")} actions={actions} />
    </FeedbackTile>;
  }
  const pickedPlaced = picked !== null && assignments[picked] >= 0;
  return <View style={styles.wrap} testID={proof ? "play-proof-model" : "play-entry-model"} nativeID={proof ? "play-proof-model" : "play-entry-model"}>
    {/* VoiceOver hears each completed pick or move: the picked tile, or where the moved tile now is. */}
    <Announce trigger={`${picked}|${assignments.join(",")}`} message={picked !== null ? t("challenges.pickedTile", { value: labels[picked] })
      : moved !== null ? t("challenges.sortTile", { value: labels[moved], group: assignments[moved] < 0 ? t("challenges.unplaced") : buckets[assignments[moved]] }) : null} />

    <PuzzleDragBoard floatingStyle={numberTileFaces.lifted} onDrop={drop} onDragStateChange={onDragStateChange}>
      <View style={styles.buckets}>{buckets.map((label, bucket) => {
        let order = 0;
        const active = proof && !proof.beats.settled ? proof.indices[proof.beats.landed] : undefined;
        const showing = active !== undefined && assignments[active] === bucket;

        return <PuzzleDropArea fillOnly key={bucket} id={`bucket-${bucket}`} label={label} style={[styles.bucket, { backgroundColor: bucket % 2 ? Quantity.violet.soft : Quantity.teal.soft }]}>
          <View style={styles.bucketTitle}>{p.rule === "fractions" ? <>
            <TileLabel label={label} size={24} />
            {/* The reference strip has the tiles' length, so 2/4 is compared with 1/2 by length, not only by reading. */}
            <View style={styles.strip}><FractionStrip parts={showing ? p.fractions[active!][1] : p.targets[bucket][1]}
              shaded={showing ? p.fractions[active!][0] : p.targets[bucket][0]} target={showing && active === proof?.mismatch ? p.targets[bucket][0] / p.targets[bucket][1] : undefined} height={32} gap={4} /></View>
          </> : <Text style={styles.bucketText}>{label}</Text>}</View>
          <View style={styles.bucketTiles}>
            {labels.flatMap((_, i) => assignments[i] === bucket ? [tile(i, order++)] : [])}
            {!answered && labels.some((_, i) => assignments[i] !== bucket) ? <PuzzleDropSlot style={sortSlot} armed={picked !== null && assignments[picked] !== bucket}
              onPress={() => picked !== null && drop(String(picked), `bucket-${bucket}`)} accessibilityLabel={t("challenges.placeIn", { group: label })} /> : null}
          </View>
        </PuzzleDropArea>;
      })}</View>
      {/* Once every tile is sorted the tray shrinks to a low return row with one visible destination. */}
      {!proof && <PuzzleDropArea fillOnly id="bank" label={t("challenges.tileBank")} style={[styles.sortBank, assignments.every(n => n >= 0) && styles.sortBankEmpty]}>
        <View style={styles.tiles}>
          {labels.flatMap((_, i) => assignments[i] < 0 ? [tile(i)] : [])}
          {assignments.every(n => n >= 0) && !answered ? <View style={styles.returnRow}>
            <PuzzleDropSlot style={sortSlot} armed={pickedPlaced} onPress={() => picked !== null && drop(String(picked), "bank")} accessibilityLabel={t("challenges.returnToBank")} />
            <Text style={styles.returnText}>{t("challenges.returnHere")}</Text>
          </View> : pickedPlaced && !answered ? <PuzzleDropSlot style={sortSlot} armed onPress={() => drop(String(picked), "bank")} accessibilityLabel={t("challenges.returnToBank")} /> : null}
        </View>
      </PuzzleDropArea>}
    </PuzzleDragBoard>
  </View>;
}

/**
 * The pattern sits on one baseline; each gap is an unknown well. Spare tiles
 * wait in a tray below. Drag a tile into a gap, or tap a tile and then a gap.
 * Placed tiles land; after Check the row pops (or misplaced tiles shake).
 */

export function sortBucketsFixtureAnswer(puzzle: SortBucketsPuzzle): SortAnswer {
  const count = puzzle.payload.rule === 'range' ? puzzle.payload.numbers.length : puzzle.payload.fractions.length;
  return { kind: 'sort', buckets: Array.from({ length: count }, (_, index) => getSortBucket(puzzle, index)) };
}

const ignore = () => {};
const sortSlot = { minWidth: SORT_W, minHeight: SORT_H, borderRadius: 14 };

export function SortBucketsReveal({ puzzle, answer, onSolutionShown }: {
  puzzle: SortBucketsPuzzle; answer: SortAnswer; onSolutionShown: () => void;
}) {
  const mismatch = answer.buckets.findIndex((bucket, i) => bucket !== getSortBucket(puzzle, i));
  const indices = mismatch < 0 ? answer.buckets.map((_, i) => i) : [mismatch];
  const beats = useRevealBeats(indices.length, {
    step: Math.min(750, 2700 / Math.max(1, indices.length)), hold: 60, minTotal: 0,
    reducedSteps: true, onDone: onSolutionShown,
  });
  return <RevealSurface beats={beats}><SortBucketsTask puzzle={puzzle} initialAnswer={answer}
    proof={{ beats, indices, mismatch }} answered onAnswerChange={ignore} onDragStateChange={ignore} /></RevealSurface>;
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(10) },
  caption: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: Ink.soft, textAlign: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: moderateScale(10) },
  sortBankEmpty: { minHeight: moderateScale(60), paddingVertical: moderateScale(6) },
  returnRow: { flexDirection: "row", alignItems: "center", gap: moderateScale(10) },
  returnText: { fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: "700", color: Ink.soft },
  sortBank: { minHeight: moderateScale(96), padding: moderateScale(10), justifyContent: "center", gap: moderateScale(6), borderRadius: Radius.tray, backgroundColor: Ink.tray },
  bucketTiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: moderateScale(8) },
  buckets: { flexDirection: "row", gap: moderateScale(12) },
  bucket: { flex: 1, minHeight: moderateScale(176), borderRadius: Radius.tray, padding: moderateScale(10), gap: moderateScale(10), backgroundColor: Ink.tray },
  bucketTitle: { alignItems: "center", paddingBottom: moderateScale(6) },
  bucketText: { fontSize: moderateScale(18), fontWeight: "800", color: Ink.text, textAlign: "center", fontVariant: ["tabular-nums"] },
  // Centred in its bucket: both reference strips are the same width and sit on the bucket's centre line (owner, wave 11).
  strip: { alignSelf: 'center', width: '100%', maxWidth: 130 },
  // Exactly the entry's tile (56 × 64 pt, same padding and radius), so the buckets never resize. Right tiles are teal; only the misplaced one is amber.
  proofCard: { minWidth: SORT_W, minHeight: SORT_H, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, backgroundColor: Quantity.teal.fill, alignItems: 'center', justifyContent: 'center' },
  mismatch: { backgroundColor: Quantity.amber.fill },
});
