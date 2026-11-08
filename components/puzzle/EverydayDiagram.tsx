import { Canvas, Circle, Line, Path, Skia } from '@shopify/react-native-skia';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { AppIcon } from '@/components/ui/AppIcon';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import type { EverydayModel } from '@/types/everyday';
import { useLocale } from '@/contexts/LocaleProvider';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const polar = (angle: number, radius: number) => ({ x: 120 + Math.sin(angle) * radius, y: 120 - Math.cos(angle) * radius });
const time = (n: number) => `${Math.floor(n / 60)}`.padStart(2, '0') + ':' + `${n % 60}`.padStart(2, '0');

/** Diagrams show givens, never the selected answer or an unrequested solution. */
export function EverydayDiagram({ model }: { model: EverydayModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const decimal = (n: number) => String(n).replace('.', locale === 'en' ? '.' : ',');
  let content;
  if (model.kind === 'clock') {
    const minute = model.minutes % 60, hour = model.minutes / 60 % 12;
    content = model.analog ? <View style={styles.clock}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={120} cy={120} r={112} color={C.cardBorder} style="stroke" strokeWidth={3} />
        {Array.from({ length: 60 }, (_, i) => <Line key={i} p1={polar(i * Math.PI / 30, i % 5 ? 104 : 99)} p2={polar(i * Math.PI / 30, 108)} color={C.textMuted} strokeWidth={i % 5 ? 1 : 2} />)}
        <Line p1={{ x: 120, y: 120 }} p2={polar(hour * Math.PI / 6, 58)} color={C.text} strokeWidth={7} strokeCap="round" />
        <Line p1={{ x: 120, y: 120 }} p2={polar(minute * Math.PI / 30, 72)} color={C.primary} strokeWidth={4} strokeCap="round" />
        <Circle cx={120} cy={120} r={6} color={C.primary} />
      </Canvas>
      {Array.from({ length: 12 }, (_, i) => { const p = polar((i + 1) * Math.PI / 6, 88); return <Text key={i} style={[styles.clockNumber, { left: p.x - 15, top: p.y - 13 }]}>{i + 1}</Text>; })}
    </View> : <View style={styles.times}>
      <Text style={styles.time}>{time(model.minutes)}</Text>
      {model.end !== undefined ? <><Text style={styles.arrow}>→</Text><Text style={styles.time}>{time(model.end)}</Text></> : null}
    </View>;
  } else if (model.kind === 'bars') {
    // A missing bar must not determine the top tick and reveal its own value.
    const visibleValues = model.values.filter((_, i) => model.task !== 'missing' || i !== model.index);
    const max = Math.max(...visibleValues) + (model.task === 'missing' ? model.step : 0);
    const ticks = Array.from({ length: max / model.step + 1 }, (_, i) => i * model.step);
    content = <View style={styles.chart}>
      <Text style={styles.caption}>{t(model.subject === 'cats' ? 'everyday.cats' : 'everyday.toys')}</Text>
      <View style={styles.plot}>
        {ticks.map(value => <View key={value} style={[styles.gridline, { bottom: value / max * 180 + 28 }]}>
          <Text style={styles.axisLabel}>{value}</Text><View style={styles.rule} />
        </View>)}
        <View style={styles.bars}>
          {model.values.map((value, i) => <View key={i} style={styles.barColumn}>
            {model.task === 'mean' ? <Text style={styles.caption}>{value}</Text> : null}
            {model.task === 'missing' && i === model.index ? <View style={styles.missingBar}><Text style={styles.unknown}>?</Text></View>
              : <View style={[styles.bar, { height: value / max * 180, backgroundColor: [C.primary, C.secondaryDark, C.challenge][i] }]} />}
            <Text style={styles.barLabel}>{['A', 'B', 'C'][i]}</Text>
          </View>)}
        </View>
      </View>
    </View>;
  } else if (model.kind === 'shapes') {
    content = <View style={styles.shapes}>{model.sides.map((sides, i) => {
      const path = Skia.Path.Make();
      if (model.rectangle) path.addRect({ x: 9, y: 35, width: 122, height: 70 });
      else for (let p = 0; p < sides; p++) {
        const a = p * Math.PI * 2 / sides - Math.PI / 2;
        const x = 70 + Math.cos(a) * 62, y = 70 + Math.sin(a) * 62;
        if (p === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.close();
      return <Canvas key={i} style={styles.shape}><Path path={path} color={C.selectedSurface} /><Path path={path} color={C.primary} style="stroke" strokeWidth={3} strokeJoin="round" /></Canvas>;
    })}</View>;
  } else if (model.kind === 'grid') {
    content = <View style={styles.spatialGrid}>
      {Array.from({ length: model.size }, (_, row) => <View key={row} style={styles.gridRow}>
        {Array.from({ length: model.size }, (_, col) => {
          const value = row * model.size + col + 1, marked = value === model.start;
          return <View key={col} style={[styles.cell, marked && styles.marked]}><Text style={[styles.cellLabel, marked && styles.markedLabel]}>{value}</Text></View>;
        })}
      </View>)}
      {model.task === 'reflect' ? <View style={styles.mirrorLine} /> : null}
      {model.task === 'rotate' ? <View style={styles.centre} /> : null}
    </View>;
  } else if (model.kind === 'money') {
    content = <View style={styles.money}>
      {!model.items ? <Text style={styles.caption}>{t('everyday.pretendMoney')}</Text> : null}
      <View style={styles.priceRow}>{model.prices.map((price, i) => <View key={i} style={model.items?.[i] ? styles.shopItem : styles.price}>
        {model.items?.[i] ? <><AppIcon name={model.items[i]} size={64} /><Text style={styles.itemName}>{t(`everyday.shopItems.${model.items[i]}`)}</Text></> : null}
        <Text style={styles.amount}>{model.unit === 'cents' ? `${price} c` : `€${decimal(price / 100)}`}</Text>
        {model.quantities[i] > 1 ? <Text style={styles.caption}>{t(model.task === 'unit' ? 'everyday.pack' : 'everyday.quantity', { count: model.quantities[i] })}</Text> : null}
      </View>)}</View>
      {model.discount ? <Text style={styles.discount}>{t('everyday.discount', { percent: model.discount })}</Text> : null}
    </View>;
  } else if (model.kind === 'capacity') {
    content = <View style={styles.vessels}>{model.amounts.map((amount, i) => {
      const capacity = model.capacities[i], step = model.task === 'read' ? 100 : Math.ceil(capacity / 5 / 250) * 250;
      const ticks = Array.from({ length: Math.floor(capacity / step) + 1 }, (_, j) => j * step);
      return <View key={i} style={styles.vesselGroup}>
        <Text style={styles.caption}>{capacity} ml</Text>
        <View style={styles.vessel}>
          <View style={[styles.liquid, { height: `${amount / capacity * 100}%` }]} />
          {ticks.map(value => <View key={value} style={[styles.measureMark, { bottom: `${value / capacity * 100}%` }]}><Text style={styles.measureText}>{value}</Text></View>)}
        </View>
        {model.task !== 'read' ? <Text style={styles.caption}>{amount} ml</Text> : null}
      </View>;
    })}</View>;
  } else {
    const path = Skia.Path.Make();
    path.moveTo(35, 70); path.lineTo(160, 70); path.lineTo(160, 170); path.lineTo(35, 170); path.close();
    path.moveTo(35, 70); path.lineTo(90, 30); path.lineTo(215, 30); path.lineTo(215, 130); path.lineTo(160, 170);
    path.moveTo(160, 70); path.lineTo(215, 30);
    content = <View style={styles.solid}><Canvas style={styles.solidCanvas}><Path path={path} style="stroke" strokeWidth={3} color={C.primary} strokeJoin="round" /></Canvas>
      <Text style={styles.caption}>{model.width} cm × {model.height} cm × {model.depth} cm</Text>
    </View>;
  }
  return <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={styles.wrap}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.inner}>{content}</View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 16 },
  inner: { width: '100%', alignItems: 'center' },
  clock: { width: 240, height: 240 },
  clockNumber: { position: 'absolute', width: 30, textAlign: 'center', fontSize: 19, fontWeight: '700', color: C.text },
  times: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 16 },
  time: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'], color: C.text },
  arrow: { fontSize: 24, color: C.textMuted },
  caption: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.textMuted },
  chart: { width: '100%', maxWidth: 360, gap: 12 },
  plot: { height: 240, width: '100%' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1 },
  axisLabel: { position: 'absolute', top: -10, left: 0, width: 42, height: 20, lineHeight: 20, textAlign: 'right', paddingRight: 8, fontSize: 13, color: C.textMuted },
  rule: { marginLeft: 42, height: 1, backgroundColor: C.cardBorder },
  bars: { position: 'absolute', left: 50, right: 8, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 16 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '75%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { height: 28, paddingTop: 4, fontSize: 16, fontWeight: '700', color: C.text },
  missingBar: { height: 100, width: '75%', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: C.textMuted },
  unknown: { fontSize: 26, fontWeight: '900', color: C.text },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  shape: { width: 140, height: 140 },
  spatialGrid: { width: '100%', maxWidth: 280, gap: 2 },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.card },
  cellLabel: { color: C.textMuted, fontSize: 15, fontWeight: '700' },
  marked: { backgroundColor: C.primary, borderColor: C.primaryDark },
  markedLabel: { color: C.card },
  mirrorLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: C.text, opacity: 0.6 },
  centre: { position: 'absolute', left: '50%', top: '50%', width: 32, height: 32, borderRadius: 16, marginLeft: -16, marginTop: -16, borderWidth: 2, borderColor: C.text },
  money: { width: '100%', gap: 16 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  price: { minWidth: 92, padding: 16, borderWidth: 2, borderColor: C.cardBorder, borderRadius: 12, gap: 6 },
  shopItem: { width: 132, maxWidth: '100%', paddingVertical: 8, alignItems: 'center', gap: 6 },
  itemName: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: C.text, textAlign: 'center' },
  amount: { fontSize: 26, fontWeight: '900', textAlign: 'center', color: C.text },
  discount: { textAlign: 'center', color: C.primaryDark, fontWeight: '700', fontSize: 18 },
  vessels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 },
  vesselGroup: { width: 112, alignItems: 'center', gap: 12 },
  vessel: { width: 100, height: 200, borderWidth: 2, borderColor: C.textMuted, borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: 6 },
  liquid: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.headerGlow, borderTopWidth: 2, borderColor: C.secondaryDark, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  measureMark: { position: 'absolute', left: 0, width: 16, borderTopWidth: 1, borderColor: C.textMuted },
  measureText: { position: 'absolute', left: 20, top: -9, width: 64, lineHeight: 18, fontSize: 12, color: C.text },
  solid: { alignItems: 'center', gap: 8 },
  solidCanvas: { width: 250, height: 190 },
});
