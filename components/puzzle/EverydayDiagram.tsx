import { GridDiagram } from '@/components/puzzle/GridDiagram';
import { BarChart } from '@/components/puzzle/BarChart';
import { MoneyReveal } from '@/components/puzzle/MoneyReveal';
import { MoneyCoin } from '@/components/puzzle/MoneyCoin';
import { JugPour } from '@/components/puzzle/JugPour';
import { ClockDiagram } from '@/components/puzzle/ClockDiagram';
import { VolumeBox } from '@/components/puzzle/VolumeBox';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { AppIcon } from '@/components/ui/AppIcon';
import { ShapeDiagram } from '@/components/puzzle/ShapeDiagram';
import { PortionContainer } from '@/components/puzzle/PortionContainer';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import type { EverydayModel } from '@/types/everyday';
import { useLocale } from '@/contexts/LocaleProvider';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const VESSEL_RADIUS = 14;

/** Diagrams show givens, never the selected answer or an unrequested solution. */
export function EverydayDiagram({ model, onSolutionShown }: { model: EverydayModel; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const decimal = (n: number) => String(n).replace('.', locale === 'en' ? '.' : ',');
  let content;
  if (model.kind === 'clock') {
    return <ClockDiagram model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'bars') {
    return <BarChart key={onSolutionShown ? 'reveal' : 'givens'} model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'shapes') {
    return <ShapeDiagram model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'grid') {
    return <GridDiagram model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'money') {
    if (onSolutionShown) return <MoneyReveal model={model} onSolutionShown={onSolutionShown} />;
    if (model.coins) return <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={styles.wrap}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.priceRow}>
        {model.prices.flatMap((price, i) => Array.from({ length: model.quantities[i] }, (_, n) => <MoneyCoin key={i + '-' + n} value={price} size={59} />))}
      </View>
    </View>;
    content = <View style={styles.money}>
      {!model.items ? <Text style={styles.caption}>{t('everyday.pretendMoney')}</Text> : null}
      <View style={styles.priceRow}>{model.prices.map((price, i) => <View key={i} style={model.items?.[i] ? styles.shopItem : styles.price}>
        {model.items?.[i] ? <><View style={styles.itemPictures}>{Array.from({ length: model.quantities[i] }, (_, index) => <AppIcon key={index} name={model.items![i]} size={model.quantities[i] > 1 ? 40 : 64} />)}</View><Text style={styles.itemName}>{t(`everyday.shopItems.${model.items[i]}`)}</Text><Text style={styles.caption}>{t(model.task === 'unit' ? 'everyday.packPrice' : 'everyday.priceEach')}</Text></> : null}
        <Text style={styles.amount}>{model.unit === 'cents' ? `${price} c` : `€${decimal(price / 100)}`}</Text>
        {model.quantities[i] > 1 ? <Text style={styles.caption}>{t(model.task === 'unit' ? 'everyday.pack' : 'everyday.quantity', { count: model.quantities[i] })}</Text> : null}
      </View>)}</View>
      {model.discount ? <Text style={styles.discount}>{t('everyday.discount', { percent: model.discount })}</Text> : null}
    </View>;
  } else if (model.kind === 'capacity') {
    if (onSolutionShown) return <JugPour model={model} onSolutionShown={onSolutionShown} />;
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
    return <VolumeBox model={model} onSolutionShown={onSolutionShown} />;
  }
  return <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={styles.wrap}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.inner}>{content}</View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  inner: { width: '100%', alignItems: 'center' },
  caption: { flexShrink: 1, fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.textMuted },
  itemPictures: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
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
});
