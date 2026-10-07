import { VisualPracticeBoard } from "@/components/puzzle/VisualPracticeBoard";
import { IconText as Text } from "@/components/ui/IconText";
import { FractionPieChart } from "@/components/puzzle/FractionPieChart";
import { NumberLineTrack } from "@/components/puzzle/NumberLineTrack";
import { GameColors } from "@/constants/game";
import type { VisualScene } from "@/types/visual-explanation";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";

type VisualExplanationSceneProps = {
  scene: VisualScene;
};

function ItemGrid({
  emoji,
  count,
  removed = 0,
  maxVisible = 20,
}: {
  emoji: string;
  count: number;
  removed?: number;
  maxVisible?: number;
}) {
  const visible = Math.min(count, maxVisible);
  const kept = Math.max(0, visible - removed);

  return (
    <View style={styles.itemsWrap}>
      {Array.from({ length: visible }, (_, index) => {
        const isRemoved = index >= kept;
        return (
          <Text
            key={`item-${index}`}
            style={[styles.itemEmoji, isRemoved && styles.itemRemoved]}
          >
            {emoji}
          </Text>
        );
      })}
      {count > maxVisible ? (
        <Text style={styles.moreLabel}>+{count - maxVisible}</Text>
      ) : null}
      <Text style={styles.countBadge}>{count}</Text>
    </View>
  );
}

function GroupsScene({
  emoji,
  groups,
}: {
  emoji: string;
  groups: { count: number; color: string }[];
}) {
  return (
    <View style={styles.groupsRow}>
      {groups.map((group, groupIndex) => (
        <View
          key={`group-${groupIndex}`}
          style={[
            styles.groupCard,
            { borderLeftWidth: 3, borderLeftColor: group.color },
          ]}
        >
          {group.count > 5 ? (
            <Text style={styles.groupEmojiSingle}>{emoji}</Text>
          ) : (
            <View style={styles.groupItems}>
              {Array.from({ length: group.count }, (_, index) => (
                <Text key={`g-${groupIndex}-${index}`} style={styles.itemEmoji}>
                  {emoji}
                </Text>
              ))}
            </View>
          )}
          <Text style={[styles.groupNumber, { color: group.color }]}>
            {group.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NumberLineScene({
  min,
  max,
  markers,
  highlight,
}: {
  min: number;
  max: number;
  markers: number[];
  highlight?: number;
}) {
  return (
    <View style={styles.numberLine}>
      <View style={styles.numberLineTrack} />
      {markers.map((value) => (
        <View key={`mark-${value}`} style={styles.numberMarkWrap}>
          <View
            style={[
              styles.numberDot,
              highlight === value && styles.numberDotHighlight,
            ]}
          />
          <Text
            style={[
              styles.numberMark,
              highlight === value && styles.numberMarkHighlight,
            ]}
          >
            {value}
          </Text>
        </View>
      ))}
      <Text style={styles.numberRange}>
        {min} … {max}
      </Text>
    </View>
  );
}

function NumberLineJumpScene({ start, jump, moves }: {
  start: number;
  jump: number;
  moves: number;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<number | null>(null);
  const exampleKey = `${start}-${jump}-${moves}`;
  const [previousExample, setPreviousExample] = useState(exampleKey);
  if (exampleKey !== previousExample) { setPreviousExample(exampleKey); setPicked(null); }
  const direction = Math.sign(jump);
  const current = start + direction * moves;
  const finished = moves === Math.abs(jump);
  const jumpLabel = t(jump >= 0 ? "puzzleTypes.jumpForward" : "puzzleTypes.jumpBack", {
    count: Math.abs(jump),
  });

  return (
    <View style={styles.jumpExample}>
      <Text style={styles.jumpPrompt}>
        {picked === null
          ? t("puzzleTypes.numberLinePrompt", { start, jump: jumpLabel })
          : t(picked === current ? "visualHelp.numberLine.success" : "visualHelp.numberLine.tryTap")}
      </Text>
      <NumberLineTrack
        min={1} max={7} start={start} value={current} hops={moves} direction={direction} fit
        onSelect={finished ? setPicked : undefined}
        correctValue={picked === current ? current : undefined}
        wrongValue={picked !== null && picked !== current ? picked : undefined}
      />
    </View>
  );
}

function SequenceScene({
  values,
  addendIndices,
  highlightIndex,
  jumpLabel,
}: {
  values: (number | "?" | null)[];
  addendIndices?: [number, number];
  highlightIndex?: number;
  jumpLabel?: string;
}) {
  const addendSet = new Set(addendIndices ?? []);

  return (
    <View style={styles.sequenceWrap}>
      {jumpLabel ? <Text style={styles.jumpLabel}>{jumpLabel}</Text> : null}
      <View style={styles.sequenceRow}>
        {values.map((value, index) => {
          const isAddend = addendSet.has(index);
          const isResult = highlightIndex === index;

          return (
            <View key={`seq-${index}`} style={styles.sequenceCellWrap}>
              <View
                style={[
                  styles.sequenceCell,
                  isAddend && styles.sequenceCellAddend,
                  isResult && styles.sequenceCellHighlight,
                ]}
              >
                <Text
                  style={[
                    styles.sequenceValue,
                    isAddend && styles.sequenceValueAddend,
                    isResult && styles.sequenceValueHighlight,
                  ]}
                >
                  {value ?? "?"}
                </Text>
              </View>
              {index < values.length - 1 ? (
                <Text style={styles.sequenceArrow}>→</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GridScene({
  rows,
  cols,
  filled,
  emoji = "🧸",
}: {
  rows: number;
  cols: number;
  filled: number;
  emoji?: string;
}) {
  const total = rows * cols;
  const gridLabel =
    emoji === "🍕"
      ? `${filled} of ${total} slices left`
      : `${rows} × ${cols} = ${total}`;
  const gap = moderateScale(6);
  const maxGridWidth = moderateScale(252);
  const cellSize = Math.min(
    moderateScale(32),
    Math.floor((maxGridWidth - gap * (cols - 1)) / cols),
  );
  const emojiSize = Math.max(moderateScale(16), Math.round(cellSize * 0.82));

  return (
    <View style={styles.gridContainer}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.gridRow, { gap }]}>
          {Array.from({ length: cols }, (_, colIndex) => {
            const index = rowIndex * cols + colIndex;
            const isRemaining = index < filled;

            return (
              <View
                key={`cell-${index}`}
                style={[
                  styles.gridCell,
                  {
                    width: cellSize,
                    height: cellSize,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gridEmoji,
                    { fontSize: emojiSize },
                    !isRemaining && styles.gridEmojiEaten,
                  ]}
                >
                  {emoji}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.gridLabel}>{gridLabel}</Text>
    </View>
  );
}

function EquationScene({
  lines,
  highlightLine,
}: {
  lines: string[];
  highlightLine?: number;
}) {
  return (
    <View style={styles.equationWrap}>
      {lines.map((line, index) => (
        <Text
          key={`line-${index}`}
          style={[
            styles.equationLine,
            highlightLine === index && styles.equationLineHighlight,
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

function CompareScene({
  left,
  right,
  operator,
  result,
}: {
  left: { emoji: string; count: number; label?: string };
  right: { emoji: string; count: number; label?: string };
  operator: "+" | "−" | "×" | "÷";
  result?: number;
}) {
  return (
    <View style={styles.compareWrap}>
      <View style={styles.compareSide}>
        <Text style={styles.compareEmoji}>{left.emoji}</Text>
        <Text style={styles.compareCount}>{left.count}</Text>
      </View>
      <Text style={styles.compareOperator}>{operator}</Text>
      <View style={styles.compareSide}>
        <Text style={styles.compareEmoji}>{right.emoji}</Text>
        <Text style={styles.compareCount}>{right.count}</Text>
      </View>
      {result !== undefined ? (
        <>
          <Text style={styles.compareOperator}>=</Text>
          <Text style={styles.compareResult}>{result}</Text>
        </>
      ) : null}
    </View>
  );
}

export function VisualExplanationScene({ scene }: VisualExplanationSceneProps) {
  if (scene.kind === "practice") return <VisualPracticeBoard {...scene} />;
  return (
    <View style={[styles.stage, scene.kind === "numberline_jump" && styles.jumpStage]}>
      {scene.kind === "fraction" ? <FractionPieChart shaded={scene.numerator} denominator={scene.denominator} /> : null}
      {scene.kind === "items" ? (
        <ItemGrid
          emoji={scene.emoji}
          count={scene.count}
          removed={scene.removed}
          maxVisible={scene.maxVisible}
        />
      ) : null}
      {scene.kind === "groups" ? (
        <GroupsScene emoji={scene.emoji} groups={scene.groups} />
      ) : null}
      {scene.kind === "numberline" ? (
        <NumberLineScene
          min={scene.min}
          max={scene.max}
          markers={scene.markers}
          highlight={scene.highlight}
        />
      ) : null}
      {scene.kind === "numberline_jump" ? (
        <NumberLineJumpScene start={scene.start} jump={scene.jump} moves={scene.moves} />
      ) : null}
      {scene.kind === "sequence" ? (
        <SequenceScene
          values={scene.values}
          addendIndices={scene.addendIndices}
          highlightIndex={scene.highlightIndex}
          jumpLabel={scene.jumpLabel}
        />
      ) : null}
      {scene.kind === "grid" ? (
        <GridScene
          rows={scene.rows}
          cols={scene.cols}
          filled={scene.filled}
          emoji={scene.emoji}
        />
      ) : null}
      {scene.kind === "equation" ? (
        <EquationScene
          lines={scene.lines}
          highlightLine={scene.highlightLine}
        />
      ) : null}
      {scene.kind === "compare" ? (
        <CompareScene
          left={scene.left}
          right={scene.right}
          operator={scene.operator}
          result={scene.result}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    minHeight: moderateScale(164),
    maxHeight: moderateScale(180),
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
  },
  itemsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: moderateScale(4),
    alignItems: "center",
  },
  itemEmoji: {
    fontSize: moderateScale(28),
  },
  itemRemoved: {
    opacity: 0.2,
    textDecorationLine: "line-through",
  },
  moreLabel: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  countBadge: {
    width: "100%",
    textAlign: "center",
    marginTop: moderateScale(8),
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.primary,
  },
  groupsRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    flexWrap: "wrap",
    justifyContent: "center",
  },
  groupCard: {
    borderRadius: moderateScale(12),
    padding: moderateScale(10),
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: GameColors.card,
  },
  groupItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(2),
    justifyContent: "center",
    maxWidth: moderateScale(120),
  },
  groupEmojiSingle: {
    fontSize: moderateScale(28),
  },
  groupNumber: {
    fontSize: moderateScale(24),
    fontWeight: "800",
  },
  jumpExample: {
    width: "100%",
    gap: moderateScale(6),
  },
  jumpPrompt: {
    textAlign: "center",
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
    fontWeight: "700",
    color: GameColors.text,
    marginBottom: moderateScale(6),
  },
  jumpStage: {
    maxHeight: undefined,
    padding: moderateScale(12),
  },
  numberLine: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(8),
  },
  numberLineTrack: {
    width: "90%",
    height: moderateScale(4),
    backgroundColor: "#E8ECEF",
    borderRadius: moderateScale(2),
  },
  numberMarkWrap: {
    alignItems: "center",
    gap: moderateScale(4),
  },
  numberDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: GameColors.cardBorder,
  },
  numberDotHighlight: {
    backgroundColor: GameColors.primary,
    transform: [{ scale: 1.3 }],
  },
  numberMark: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  numberMarkHighlight: {
    color: GameColors.primary,
    fontSize: moderateScale(20),
  },
  numberRange: {
    fontSize: moderateScale(13),
    color: GameColors.textMuted,
  },
  sequenceWrap: {
    alignItems: "center",
    gap: moderateScale(8),
  },
  jumpLabel: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
  },
  sequenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: moderateScale(4),
  },
  sequenceCellWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  sequenceCell: {
    minWidth: moderateScale(44),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  sequenceCellHighlight: {
    backgroundColor: "#FFF0EE",
  },
  sequenceCellAddend: {
    backgroundColor: "#E8FAF8",
  },
  sequenceValue: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
  },
  sequenceValueAddend: {
    color: GameColors.secondary,
    fontSize: moderateScale(22),
  },
  sequenceValueHighlight: {
    color: GameColors.primary,
    fontSize: moderateScale(24),
  },
  sequenceArrow: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: GameColors.textMuted,
    marginHorizontal: moderateScale(2),
  },
  gridContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
    width: "100%",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  gridCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  gridEmoji: {
    fontSize: moderateScale(18),
  },
  gridEmojiEaten: {
    opacity: 0.2,
    textDecorationLine: "line-through",
  },
  gridLabel: {
    width: "100%",
    textAlign: "center",
    marginTop: moderateScale(4),
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: GameColors.text,
  },
  equationWrap: {
    alignItems: "center",
    gap: moderateScale(8),
  },
  equationLine: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  equationLineHighlight: {
    color: GameColors.primary,
    fontSize: moderateScale(26),
    fontWeight: "800",
  },
  compareWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
    flexWrap: "wrap",
    justifyContent: "center",
  },
  compareSide: {
    alignItems: "center",
    gap: moderateScale(4),
    paddingHorizontal: moderateScale(8),
    minWidth: moderateScale(64),
  },
  compareEmoji: {
    fontSize: moderateScale(32),
  },
  compareCount: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  compareOperator: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.textMuted,
  },
  compareResult: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.primary,
  },
});
