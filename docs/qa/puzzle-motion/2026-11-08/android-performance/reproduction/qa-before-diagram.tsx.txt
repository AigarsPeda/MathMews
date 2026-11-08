import { insetRadius } from '@/utils/border-radius';
import { Canvas, Circle, Group, Line, Path, Skia } from '@shopify/react-native-skia';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { AppIcon } from '@/components/ui/AppIcon';
import { PuzzleObjectImage } from '@/components/puzzle/PuzzleObjectImage';
import { PortionContainer } from '@/components/puzzle/PortionContainer';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import type { EverydayModel } from '@/types/everyday';
import { useLocale } from '@/contexts/LocaleProvider';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

const SPATIAL_FRAME = { radius: 12, padding: 4, border: 2 };
const BAR_RADIUS = 10;
const BAR_BORDER = 1;
const VESSEL_RADIUS = 14;
const CLOCK_RADIUS = 115;
const CLOCK_RIM = 14;

const polar = (angle: number, radius: number) => ({ x: 120 + Math.sin(angle) * radius, y: 120 - Math.cos(angle) * radius });
const time = (n: number) => `${Math.floor(n / 60)}`.padStart(2, '0') + ':' + `${n % 60}`.padStart(2, '0');
const barFinishes = [
  { face: '#D9518A', edge: '#A82D64' },
  { face: '#59B7A9', edge: '#277D74' },
  { face: '#A385D1', edge: '#70509D' },
];

/** Diagrams show givens, never the selected answer or an unrequested solution. */
export function EverydayDiagram({ model }: { model: EverydayModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { width: viewportWidth, height: viewportHeight, fontScale } = useWindowDimensions();
  const decimal = (n: number) => String(n).replace('.', locale === 'en' ? '.' : ',');
  let content;
  if (model.kind === 'clock') {
    const minute = model.minutes % 60, hour = model.minutes / 60 % 12;
    // Scale numerals with the whole dial so they stay attached to their hour marks.
    const clockSize = Math.min(viewportWidth - 48, Math.max(200, Math.min(240, Math.round(viewportHeight * .245))) * fontScale);
    const clockScale = clockSize / 240;
    content = model.analog ? <View style={{ width: clockSize, height: clockSize }}><View style={[styles.clock, { left: (clockSize - 240) / 2, top: (clockSize - 240) / 2, transform: [{ scale: clockScale }] }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={120} cy={124} r={CLOCK_RADIUS} color={D.goldEdge} />
        <Circle cx={120} cy={120} r={CLOCK_RADIUS} color={D.gold} />
        <Circle cx={120} cy={120} r={insetRadius(CLOCK_RADIUS, CLOCK_RIM)} color={C.card} />
        {Array.from({ length: 60 }, (_, i) => <Line key={i} p1={polar(i * Math.PI / 30, i % 5 ? 96 : 91)} p2={polar(i * Math.PI / 30, 99)} color={i % 5 ? C.cardBorder : C.textMuted} strokeWidth={i % 5 ? 1 : 3} strokeCap="round" />)}
        <Line p1={{ x: 120, y: 120 }} p2={polar(hour * Math.PI / 6, 58)} color={D.geometryEdge} strokeWidth={8} strokeCap="round" />
        <Line p1={{ x: 120, y: 120 }} p2={polar(minute * Math.PI / 30, 72)} color={C.primary} strokeWidth={6} strokeCap="round" />
        <Circle cx={120} cy={120} r={6} color={C.primary} />
      </Canvas>
      {Array.from({ length: 12 }, (_, i) => { const p = polar((i + 1) * Math.PI / 6, 80); return <Text key={i} allowFontScaling={false} style={[styles.clockNumber, { left: p.x - 15, top: p.y - 13 }]}>{i + 1}</Text>; })}
    </View></View> : <View style={styles.times}>
      <Text style={styles.time}>{time(model.minutes)}</Text>
      {model.end !== undefined ? <><Text style={styles.arrow}>→</Text><Text style={styles.time}>{time(model.end)}</Text></> : null}
    </View>;
  } else if (model.kind === 'bars') {
    // A missing bar must not determine the top tick and reveal its own value.
    const visibleValues = model.values.filter((_, i) => model.task !== 'missing' || i !== model.index);
    const max = Math.max(...visibleValues) + (model.task === 'missing' ? model.step : 0);
    const ticks = Array.from({ length: max / model.step + 1 }, (_, i) => i * model.step);
    // Save room for the question and answers without compressing dense scales or large text.
    const plotHeight = Math.max(Math.min(180, Math.max(120, Math.round(viewportHeight * .16))), (ticks.length - 1) * 20 * fontScale);
    const labelHeight = Math.max(28, 24 * fontScale + 4);
    const headroom = (model.task === 'mean' ? 28 : 12) * fontScale;
    content = <View style={styles.chart}>
      <View style={styles.subject}><AppIcon name={model.subject === 'cats' ? 'cat' : 'mouse'} size={32} /><Text style={styles.chartTitle}>{t(model.subject === 'cats' ? 'everyday.catCount' : 'everyday.toyCount')}</Text></View>
      <View style={[styles.plot, { height: plotHeight + labelHeight + headroom }]}>
        {ticks.map(value => <View key={value} style={[styles.gridline, { bottom: value / max * plotHeight + labelHeight }]}>
          <Text style={[styles.axisLabel, { top: -10 * fontScale, height: 20 * fontScale }]}>{value}</Text><View style={styles.rule} />
        </View>)}
        <View style={styles.bars}>
          {model.values.map((value, i) => <View key={i} style={styles.barColumn}>
            {model.task === 'mean' ? <Text style={styles.caption}>{value}</Text> : null}
            {model.task === 'missing' && i === model.index ? <View style={styles.missingBar}><Text style={styles.unknown}>?</Text></View>
              : <View style={[styles.bar, { height: value / max * plotHeight, backgroundColor: barFinishes[i % barFinishes.length].face, borderColor: barFinishes[i % barFinishes.length].edge }]}>
                <View style={styles.barTopLight} />
              </View>}
            <Text style={[styles.barLabel, { height: labelHeight }]}>{['A', 'B', 'C'][i]}</Text>
          </View>)}
        </View>
      </View>
    </View>;
  } else if (model.kind === 'shapes') {
    const shapeSize = Math.min(140, (viewportWidth - 44 - 12 * (model.sides.length - 1)) / model.sides.length);
    content = <View style={styles.money}>{model.context === 'mats' ? <View style={styles.subject}><View style={styles.ribbon}><PuzzleObjectImage object="ribbon" /></View><Text style={styles.caption}>{t('everyday.ribbonPerCorner')}</Text></View> : null}<View style={styles.shapes}>{model.sides.map((sides, i) => {
      const path = Skia.Path.Make();
      if (model.rectangle) path.addRect({ x: 9, y: 35, width: 122, height: 70 });
      else for (let p = 0; p < sides; p++) {
        const a = p * Math.PI * 2 / sides - Math.PI / 2;
        const x = 70 + Math.cos(a) * 62, y = 70 + Math.sin(a) * 62;
        if (p === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.close();
      // Follow the upper edge, inset toward the centre, rather than crossing the face.
      const edgeStart = model.rectangle ? { x: 9, y: 35 } : { x: 70, y: 8 };
      const angle = Math.PI * 2 / sides - Math.PI / 2;
      const edgeEnd = model.rectangle ? { x: 131, y: 35 } : { x: 70 + Math.cos(angle) * 62, y: 70 + Math.sin(angle) * 62 };
      const dx = edgeEnd.x - edgeStart.x, dy = edgeEnd.y - edgeStart.y;
      const length = Math.hypot(dx, dy), inset = 9, endGap = 13;
      const lightStart = { x: edgeStart.x + dx / length * endGap - dy / length * inset, y: edgeStart.y + dy / length * endGap + dx / length * inset };
      const lightEnd = { x: edgeEnd.x - dx / length * endGap - dy / length * inset, y: edgeEnd.y - dy / length * endGap + dx / length * inset };
      return <Canvas key={i} style={{ width: shapeSize, height: shapeSize }}><Group transform={[{ scale: shapeSize / 140 }]}>
        <Path path={path} color={i % 2 ? D.geometryFill : D.gold} />
        <Path path={path} color={i % 2 ? D.geometryFill : D.gold} style="stroke" strokeWidth={6} strokeJoin="round" />
        <Group clip={path}>
          <Line p1={lightStart} p2={lightEnd} color={D.highlight} strokeWidth={5} strokeCap="round" />
        </Group>
      </Group></Canvas>;
    })}</View></View>;
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
      {!model.items && !model.coins ? <Text style={styles.caption}>{t('everyday.pretendMoney')}</Text> : null}
      <View style={styles.priceRow}>{model.prices.map((price, i) => <View key={i} style={model.items?.[i] || model.coins ? styles.shopItem : styles.price}>
        {model.coins ? <AppIcon name="coin" size={64} /> : model.items?.[i] ? <><View style={styles.itemPictures}>{Array.from({ length: model.quantities[i] }, (_, index) => <AppIcon key={index} name={model.items![i]} size={model.quantities[i] > 1 ? 40 : 64} />)}</View><Text style={styles.itemName}>{t(`everyday.shopItems.${model.items[i]}`)}</Text><Text style={styles.caption}>{t(model.task === 'unit' ? 'everyday.packPrice' : 'everyday.priceEach')}</Text></> : null}
        <Text style={styles.amount}>{model.unit === 'cents' ? `${price} c` : `€${decimal(price / 100)}`}</Text>
        {model.quantities[i] > 1 ? <Text style={styles.caption}>{t(model.task === 'unit' ? 'everyday.pack' : 'everyday.quantity', { count: model.quantities[i] })}</Text> : null}
      </View>)}</View>
      {model.discount ? <Text style={styles.discount}>{t('everyday.discount', { percent: model.discount })}</Text> : null}
    </View>;
  } else if (model.kind === 'capacity') {
    content = <View style={styles.vessels}>{model.amounts.map((amount, i) => {
      const capacity = model.capacities[i], step = model.task === 'read' ? 100 : Math.ceil(capacity / 5 / 250) * 250;
      const ticks = Array.from({ length: Math.floor(capacity / step) + 1 }, (_, j) => j * step);
      return <View key={i} style={[styles.vesselGroup, (model.amounts.length > 1 || !!model.portionContainer) && styles.pairedVessel]}>
        <Text style={[styles.caption, styles.vesselCaption]}>{capacity} ml</Text>
        <View style={[styles.vessel, (model.amounts.length > 1 || !!model.portionContainer) && styles.pairedVessel]}>
          <View style={styles.vesselHandle} />
          <View style={styles.vesselBody}>
            <View style={[styles.liquid, { height: `${amount / capacity * 100}%` }]}>
              <View style={styles.waterSurface} />
            </View>
            <View style={styles.glassHighlight} />
          </View>
          <View style={styles.vesselOutline} />
          <View style={styles.vesselLip} />
          {ticks.map(value => <View key={value} style={[styles.measureMark, { bottom: `${value / capacity * 100}%` }]}><Text style={styles.measureText}>{value}</Text></View>)}
        </View>
        {model.task !== 'read' ? <Text style={styles.volumeLabel}>{amount} ml</Text> : null}
      </View>;
    })}{model.portionContainer ? <PortionContainer kind={model.portionContainer} amount={model.portion} /> : null}</View>;
  } else {
    const path = Skia.Path.Make();
    path.moveTo(35, 70); path.lineTo(160, 70); path.lineTo(160, 170); path.lineTo(35, 170); path.close();
    path.moveTo(35, 70); path.lineTo(90, 30); path.lineTo(215, 30); path.lineTo(215, 130); path.lineTo(160, 170);
    path.moveTo(160, 70); path.lineTo(215, 30);
    const face = (points: number[][]) => {
      const p = Skia.Path.Make();
      points.forEach(([x,y], i) => i ? p.lineTo(x,y) : p.moveTo(x,y));
      p.close(); return p;
    };
    content = <View style={styles.solid}><Canvas style={styles.solidCanvas}>
      <Path path={face([[35,70],[160,70],[160,170],[35,170]])} color={D.solidFront} />
      <Path path={face([[35,70],[90,30],[215,30],[160,70]])} color={D.solidTop} />
      <Path path={face([[160,70],[215,30],[215,130],[160,170]])} color={D.solidSide} />
      <Path path={path} style="stroke" strokeWidth={4} color={D.solidSide} strokeJoin="round" />
    </Canvas>
      <Text style={styles.caption}>{model.width} cm × {model.height} cm × {model.depth} cm</Text>
    </View>;
  }
  return <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={styles.wrap}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.inner}>{content}</View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  chartTitle: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center', color: C.text },
  inner: { width: '100%', alignItems: 'center' },
  clock: { position: 'absolute', width: 240, height: 240 },
  clockNumber: { position: 'absolute', width: 30, textAlign: 'center', fontSize: 19, fontWeight: '900', color: C.text },
  times: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 16 },
  time: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'], color: C.text, backgroundColor: D.glass, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: C.cardBorder },
  arrow: { fontSize: 24, color: C.textMuted },
  caption: { flexShrink: 1, fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.textMuted },
  subject: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ribbon: { width: 48, height: 48 },
  itemPictures: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
  chart: { width: '100%', maxWidth: 360, gap: 6 },
  plot: { width: '100%' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1 },
  axisLabel: { position: 'absolute', top: -10, left: 0, width: 42, height: 20, lineHeight: 20, textAlign: 'right', paddingRight: 8, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], color: C.textMuted },
  rule: { marginLeft: 42, height: 1, backgroundColor: C.cardBorder },
  bars: { position: 'absolute', left: 50, right: 8, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 16 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  // All shading stays inside the measured height; the upper edge is the value.
  bar: { width: '75%', borderTopLeftRadius: BAR_RADIUS, borderTopRightRadius: BAR_RADIUS, borderWidth: BAR_BORDER, borderBottomWidth: 0, overflow: 'hidden' },
  barTopLight: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: D.highlight, borderTopLeftRadius: insetRadius(BAR_RADIUS, BAR_BORDER), borderTopRightRadius: insetRadius(BAR_RADIUS, BAR_BORDER) },
  barLabel: { paddingTop: 4, lineHeight: 24, fontSize: 17, fontWeight: '800', color: C.text },
  missingBar: { height: 100, width: '75%', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: C.textMuted, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: C.progressTrack },
  unknown: { fontSize: 26, fontWeight: '900', color: C.text },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  shape: { width: 140, height: 140 },
  spatialGrid: { width: '100%', maxWidth: 240, gap: 2, padding: SPATIAL_FRAME.padding, borderWidth: SPATIAL_FRAME.border, borderColor: C.cardBorder, borderRadius: SPATIAL_FRAME.radius, backgroundColor: C.progressTrack },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.card, borderRadius: insetRadius(SPATIAL_FRAME.radius, SPATIAL_FRAME.padding + SPATIAL_FRAME.border) },
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
  vessels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  vesselGroup: { width: 184, alignItems: 'center', gap: 8 },
  vessel: { width: 184, height: 180, marginTop: 14, marginBottom: 6 },
  pairedVessel: { width: 160 },
  vesselCaption: { marginLeft: 28 },
  vesselHandle: { position: 'absolute', right: 0, top: 44, width: 30, height: 86, borderWidth: 8, borderColor: D.glassEdge, borderRadius: 14, backgroundColor: D.glass },
  vesselBody: { position: 'absolute', left: 48, right: 18, top: 0, bottom: 0, backgroundColor: D.glass, borderBottomLeftRadius: VESSEL_RADIUS, borderBottomRightRadius: VESSEL_RADIUS, overflow: 'hidden' },
  vesselOutline: { position: 'absolute', left: 48, right: 18, top: 0, bottom: 0, borderWidth: 4, borderTopWidth: 0, borderColor: D.glassEdge, borderBottomLeftRadius: VESSEL_RADIUS, borderBottomRightRadius: VESSEL_RADIUS },
  vesselLip: { position: 'absolute', left: 44, right: 14, top: -5, height: 6, borderRadius: 3, backgroundColor: D.glassEdge },
  liquid: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: D.waterTop },
  waterSurface: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: D.waterLine },
  glassHighlight: { position: 'absolute', top: 14, bottom: 18, right: 12, width: 10, borderRadius: 5, backgroundColor: D.highlight },
  measureMark: { position: 'absolute', left: 40, width: 18, borderTopWidth: 1, borderColor: C.textMuted },
  measureText: { position: 'absolute', right: 22, top: -10, width: 36, textAlign: 'right', lineHeight: 20, fontSize: 12, color: C.text, fontVariant: ['tabular-nums'] },
  volumeLabel: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: D.waterLine, marginLeft: 28 },
  solid: { alignItems: 'center', gap: 8 },
  solidCanvas: { width: 250, height: 190 },
});
