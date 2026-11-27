import { numberTileFaces, PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from './PuzzleDragBoard';
import { ChoiceButton } from './ChoiceButton';
import { EntryBuild } from './kit/PracticeAffordances';
import { useChoiceLayout } from './useChoiceLayout';
import { PlacementCue, useChoicePlacement } from './tiles/ChoicePlacement';
import { useTranslation } from 'react-i18next';
import { RevealSurface } from "@/components/puzzle/kit/RevealSurface";
import { useRevealBeats, type RevealBeats } from "@/components/puzzle/kit/useRevealBeats";
import { Land, Pulse } from "@/components/puzzle/tiles/TileMotion";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Ink, Quantity, Shape } from "@/constants/puzzle-theme";
import type { PatternNextPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Fragment, type ComponentType, type ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

type PatternNextTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: PatternNextPuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onDragStateChange?: (dragging: boolean) => void;
  onSelect: (index: number | null) => void;
};

const ignoreDrag = () => {};

/** One tile size and 4 pt gap for the entry, the proof and both verdicts (56–64 pt, filling the stage width), so the row only transforms in place. */
export const PATTERN_GAP = 4;
export function patternTileSize(windowWidth: number, slots: number) {
  return Math.max(56, Math.min(64, Math.floor((windowWidth - 44 - (slots - 1) * PATTERN_GAP) / slots)));
}
/** The reserved lane for a hop band: the same height above and below the row, so the row stays centred in every state. */
export const HOP_LANE = 36;
/** A given term: a flat light-teal face the same size as the proof's tile; its digits are capped at 1.4× so they stay inside the tile at XL. */
export function PatternChip({ label, tile, digits, fontScale }: { label: string; tile: number; digits: number; fontScale: number }) {
  const size = patternDigitSize(tile, digits, fontScale);
  return <View style={[styles.gap, styles.given, { width: tile, height: tile, borderRadius: Shape.tile(tile), borderBottomWidth: 0 }]}>
    <Text maxFontSizeMultiplier={1.4} style={[styles.gapMark, { fontSize: size, lineHeight: size * 1.25 }]}>{label}</Text>
  </View>;
}
/** Digits sized to the tile: 28 pt (24 pt for four digits) so a long term never collapses. */
export function patternDigitSize(tile: number, digits: number, fontScale: number) {
  return Math.max(20, Math.min(28, (tile - 6) / (Math.max(1, digits) * .6) / Math.min(fontScale, 1.4)));
}

/** "+2", "−3" or "×2" when one rule links every neighbour; otherwise null. */
export function patternStep(values: number[]): string | null {
  if (values.length < 2 || values.some(v => !Number.isFinite(v))) return null;
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  if (diffs.every(d => d === diffs[0]) && diffs[0] !== 0) return diffs[0] > 0 ? `+${diffs[0]}` : `−${-diffs[0]}`;
  const ratios = values.slice(1).map((v, i) => values[i] === 0 ? NaN : v / values[i]);
  if (ratios.every(r => r === ratios[0]) && Number.isInteger(ratios[0]) && ratios[0] > 1) return `×${ratios[0]}`;
  return null;
}

/** Keep all digits together when large text needs a second row. */
export function sequenceLayout(width: number, slots: number, digits: number, fontScale: number) {
  if (!width) return { wrap: false, slotWidth: undefined };
  const minimum = Math.max(44, digits * 16 * fontScale + 24);
  const columns = Math.max(1, Math.min(slots, Math.floor(width / minimum)));
  return { wrap: columns < slots, slotWidth: Math.floor(width / columns) };
}

/**
 * The shared "one jump each time" lane over a sequence of evenly spaced slots. Once solved, each hop is a soft
 * violet band the width of one slot (centre to centre) with its rule written inside, in a reserved lane above
 * the tiles. Nothing is drawn before there is a rule to show. Used by Pattern Next and Repair Pattern.
 */
export function HopArcs({ slots, width, beats, step, solved }: { slots: number; width: number; beats: RevealBeats; step: string | null; solved: boolean }) {
  const slot = width / slots;
  const i = Math.min(beats.landed, slots - 2);
  return <View style={{ height: HOP_LANE }} accessible={false} pointerEvents="none">
    {solved && step && width > 0 ? <Land key={`${i}-${beats.runId}`} style={[styles.hopBand, { left: (i + .5) * slot, width: slot }]}>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.step}>{step}</Text>
    </Land> : null}
  </View>;
}

/**
 * The sequence sits on one baseline in evenly spaced slots; the missing term
 * is a dashed well in the next slot. Quiet arcs show "one jump each time"
 * (unlabelled until there is a rule to show). After a correct Check each
 * hop is drawn in turn with its rule, the number it lands on pulses, and the
 * last hop places the answer in the gap.
 */
export function PatternNextTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onDragStateChange = ignoreDrag,
  onSelect,
  AnswerRow = Fragment,
}: PatternNextTaskProps) {
  const { sequence, choices } = puzzle.payload;
  const { t } = useTranslation();
  const placement = useChoicePlacement(selectedIndex, onSelect);
  const layoutChoices = useChoiceLayout(choices, true);
  const docked = AnswerRow !== Fragment;
  const destination = t('challenges.placeInGap', { position: sequence.length + 1 });
  const slots = sequence.length + 1;
  const numbers = sequence.map(Number);
  const solved = answered && isCorrect;
  const answer = choices[puzzle.correctIndex];
  const step = patternStep(solved ? [...numbers, Number(answer)] : numbers);
  const beats = useRevealBeats(solved && step ? slots - 1 : 0);
  const longest = Math.max(...sequence.map(v => String(v).length), ...choices.map(c => c.length));
  const { width: screen, fontScale } = useWindowDimensions();
  const tile = patternTileSize(screen, slots);
  const width = slots * tile + (slots - 1) * PATTERN_GAP;
  const face = { width: tile, minWidth: tile, height: tile, minHeight: tile, borderRadius: Shape.tile(tile) };
  const faceText = { fontSize: patternDigitSize(tile, longest, fontScale), lineHeight: patternDigitSize(tile, longest, fontScale) * 1.25 };
  const filled = selectedIndex !== null ? choices[selectedIndex] : null;
  // The last hop puts the answer into the gap.

  return (
    <PuzzleDragBoard floatingStyle={numberTileFaces.lifted} onDragStateChange={onDragStateChange} onDrop={(source, target) => {
      if (!answered && target === 'gap') placement.place(Number(source));
    }}>
      <RevealSurface beats={beats} replayable={solved && !!step}>
      <View style={{ width, alignSelf: "center" }} accessible={answered} accessibilityLabel={answered ? `${sequence.join(", ")}, ${filled ?? "?"}` : undefined}>
        {/* The lanes above and below are reserved in every state, so the row never moves between entry and proof. */}
        <HopArcs slots={slots} width={width} beats={beats} step={step} solved={solved} />
        <View style={styles.sequenceRow}>
          {sequence.map((value, index) => <View key={`${puzzle.id}-seq-${index}`} style={styles.slot}>
            <EntryBuild index={index}><Pulse when={solved && beats.landed === index && index > 0}><PatternChip label={String(value)} tile={tile} digits={longest} fontScale={fontScale} /></Pulse></EntryBuild>
          </View>)}
          <View style={styles.slot}><PuzzleDropArea id="gap" label={destination}>
            <Pressable testID="pattern-next-gap" accessibilityRole="button" accessibilityLabel={placement.picked === null && filled !== null ? t('challenges.returnToBank') : destination} accessibilityValue={{ text: filled ?? '?' }}
              style={styles.target} disabled={answered || !placement.enabled} onPress={placement.activate}>
            {solved ? <Pulse when={beats.done}><View style={[styles.gap, face, styles.gapFilled]}><Text maxFontSizeMultiplier={1.4} style={[styles.gapMark, faceText]}>{filled ?? answer}</Text></View></Pulse>
                : filled !== null ? <View style={[styles.gap, face, styles.gapFilled, placement.picked !== null && styles.gapActive]}><Text maxFontSizeMultiplier={1.4} style={[styles.gapMark, faceText]}>{filled}</Text></View>
                  : <View style={[styles.gap, face, placement.picked !== null && styles.gapActive]}><Text maxFontSizeMultiplier={1.4} style={[styles.gapMark, faceText]}>?</Text></View>}
            </Pressable>
          </PuzzleDropArea></View>
        </View>
        <View style={{ height: HOP_LANE }} />
      </View>
      </RevealSurface>
      {!answered && !docked && <PlacementCue instruction={t('challenges.patternTapHint')} picked={placement.picked === null ? undefined : choices[placement.picked]} />}
      {docked ? <AnswerRow><View onLayout={layoutChoices.onLayout} style={layoutChoices.container}>
        {choices.map((choice, i) => <ChoiceButton key={i} label={choice} selected={selectedIndex === i}
          style={layoutChoices.item} disabled={answered} onPress={() => placement.place(i)} />)}
      </View></AnswerRow> : <View style={styles.choices}>
        {choices.map((choice, index) => <PuzzleDragTile key={index} id={String(index)} label={choice}
          accessibilityLabel={choice} accessibilityHint={t('challenges.patternTapHint')}
          actions={[{ id: 'gap', label: destination }]} selected={placement.picked === index}
          style={[placement.picked === index ? numberTileFaces.lifted : numberTileFaces.resting, { borderRadius: Shape.tile(52) }]}
          onPress={() => placement.pick(index)} disabled={answered} grip />)}
      </View>}
    </PuzzleDragBoard>
  );
}

const styles = StyleSheet.create({
  sequenceRow: { flexDirection: "row", alignItems: "center", gap: PATTERN_GAP },
  slot: { alignItems: "center" },
  hopBand: { position: "absolute", top: 2, height: HOP_LANE - 4, borderRadius: (HOP_LANE - 4) / 2, backgroundColor: Quantity.violet.light, alignItems: "center", justifyContent: "center" },
  step: { textAlign: "center", fontSize: 24, lineHeight: 30, fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"] },
  gap: { alignItems: "center", justifyContent: "center", backgroundColor: Quantity.amber.light, borderBottomWidth: Shape.lip, borderBottomColor: Quantity.amber.fill },
  given: { backgroundColor: Quantity.teal.fill },
  gapFilled: { backgroundColor: Quantity.violet.fill, borderBottomColor: Quantity.violet.edge },
  gapActive: { backgroundColor: Quantity.amber.fill },
  gapMark: { fontSize: moderateScale(26), fontWeight: "800", color: Ink.text },
  target: { alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: moderateScale(8) },
});
