import { GameColors } from '@/constants/game';
import type { VisualScene } from '@/types/visual-explanation';
import { moderateScale } from '@/utils/scale';
import { StyleSheet, Text, View } from 'react-native';

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
          style={[styles.groupCard, { borderColor: group.color }]}
        >
          <View style={styles.groupItems}>
            {Array.from({ length: Math.min(group.count, 8) }, (_, index) => (
              <Text key={`g-${groupIndex}-${index}`} style={styles.itemEmoji}>
                {emoji}
              </Text>
            ))}
            {group.count > 8 ? (
              <Text style={styles.groupCount}>×{group.count}</Text>
            ) : null}
          </View>
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

function SequenceScene({
  values,
  highlightIndex,
  jumpLabel,
}: {
  values: (number | '?' | null)[];
  highlightIndex?: number;
  jumpLabel?: string;
}) {
  return (
    <View style={styles.sequenceWrap}>
      {jumpLabel ? <Text style={styles.jumpLabel}>{jumpLabel}</Text> : null}
      <View style={styles.sequenceRow}>
        {values.map((value, index) => (
          <View key={`seq-${index}`} style={styles.sequenceCellWrap}>
            <View
              style={[
                styles.sequenceCell,
                highlightIndex === index && styles.sequenceCellHighlight,
              ]}
            >
              <Text
                style={[
                  styles.sequenceValue,
                  highlightIndex === index && styles.sequenceValueHighlight,
                ]}
              >
                {value ?? '?'}
              </Text>
            </View>
            {index < values.length - 1 ? (
              <Text style={styles.sequenceArrow}>→</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function GridScene({
  rows,
  cols,
  filled,
}: {
  rows: number;
  cols: number;
  filled: number;
}) {
  const total = rows * cols;
  return (
    <View style={styles.gridWrap}>
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        return (
          <View
            key={`cell-${index}`}
            style={[styles.gridCell, isFilled && styles.gridCellFilled]}
          >
            <Text style={styles.gridEmoji}>{isFilled ? '🧸' : ''}</Text>
          </View>
        );
      })}
      <Text style={styles.gridLabel}>
        {rows} × {cols} = {total}
      </Text>
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
  operator: '+' | '−' | '×' | '÷';
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
  return (
    <View style={styles.stage}>
      {scene.kind === 'items' ? (
        <ItemGrid
          emoji={scene.emoji}
          count={scene.count}
          removed={scene.removed}
          maxVisible={scene.maxVisible}
        />
      ) : null}
      {scene.kind === 'groups' ? (
        <GroupsScene emoji={scene.emoji} groups={scene.groups} />
      ) : null}
      {scene.kind === 'numberline' ? (
        <NumberLineScene
          min={scene.min}
          max={scene.max}
          markers={scene.markers}
          highlight={scene.highlight}
        />
      ) : null}
      {scene.kind === 'sequence' ? (
        <SequenceScene
          values={scene.values}
          highlightIndex={scene.highlightIndex}
          jumpLabel={scene.jumpLabel}
        />
      ) : null}
      {scene.kind === 'grid' ? (
        <GridScene rows={scene.rows} cols={scene.cols} filled={scene.filled} />
      ) : null}
      {scene.kind === 'equation' ? (
        <EquationScene lines={scene.lines} highlightLine={scene.highlightLine} />
      ) : null}
      {scene.kind === 'compare' ? (
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
    minHeight: moderateScale(180),
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: moderateScale(20),
    borderWidth: 2,
    borderColor: GameColors.secondary,
    padding: moderateScale(16),
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: moderateScale(4),
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: moderateScale(28),
  },
  itemRemoved: {
    opacity: 0.2,
    textDecorationLine: 'line-through',
  },
  moreLabel: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: GameColors.textMuted,
  },
  countBadge: {
    width: '100%',
    textAlign: 'center',
    marginTop: moderateScale(8),
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: GameColors.primary,
  },
  groupsRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  groupCard: {
    borderWidth: 3,
    borderRadius: moderateScale(16),
    padding: moderateScale(10),
    alignItems: 'center',
    gap: moderateScale(6),
    backgroundColor: GameColors.card,
  },
  groupItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(2),
    justifyContent: 'center',
    maxWidth: moderateScale(120),
  },
  groupCount: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: GameColors.text,
  },
  groupNumber: {
    fontSize: moderateScale(24),
    fontWeight: '800',
  },
  numberLine: {
    width: '100%',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  numberLineTrack: {
    width: '90%',
    height: moderateScale(4),
    backgroundColor: GameColors.secondary,
    borderRadius: moderateScale(2),
  },
  numberMarkWrap: {
    alignItems: 'center',
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
    fontWeight: '700',
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
    alignItems: 'center',
    gap: moderateScale(8),
  },
  jumpLabel: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: GameColors.secondary,
    backgroundColor: '#E8FAF8',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  sequenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  sequenceCellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceCell: {
    minWidth: moderateScale(44),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceCellHighlight: {
    borderColor: GameColors.primary,
    backgroundColor: '#FFF0EE',
  },
  sequenceValue: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: GameColors.text,
  },
  sequenceValueHighlight: {
    color: GameColors.primary,
    fontSize: moderateScale(24),
  },
  sequenceArrow: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: GameColors.textMuted,
    marginHorizontal: moderateScale(2),
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: moderateScale(6),
    maxWidth: moderateScale(260),
  },
  gridCell: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(8),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellFilled: {
    borderColor: GameColors.secondary,
    backgroundColor: '#E8FAF8',
  },
  gridEmoji: {
    fontSize: moderateScale(18),
  },
  gridLabel: {
    width: '100%',
    textAlign: 'center',
    marginTop: moderateScale(8),
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: GameColors.text,
  },
  equationWrap: {
    alignItems: 'center',
    gap: moderateScale(8),
  },
  equationLine: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: GameColors.text,
    textAlign: 'center',
  },
  equationLineHighlight: {
    color: GameColors.primary,
    fontSize: moderateScale(26),
    fontWeight: '800',
  },
  compareWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  compareSide: {
    alignItems: 'center',
    gap: moderateScale(4),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(10),
    minWidth: moderateScale(72),
  },
  compareEmoji: {
    fontSize: moderateScale(32),
  },
  compareCount: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: GameColors.text,
  },
  compareOperator: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: GameColors.secondary,
  },
  compareResult: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: GameColors.primary,
  },
});
