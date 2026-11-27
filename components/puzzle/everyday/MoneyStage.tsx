import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { useLocale } from '@/contexts/LocaleProvider';
import { moneyWidth } from '@/utils/money-tape';
import { formatPriceTicket, type MoneyModel } from '@/utils/puzzle-money';
import { MoneyCoin, MoneyDiagramIcon } from '../MoneyCoin';

/** One column: every money row is exactly this wide and centred. */
export function useMoneyWidth() {
  return moneyWidth(useWindowDimensions().width);
}

export const MONEY_CARD_HEIGHT = 92;
export const MONEY_ZONE_HEIGHT = 60;
export const MONEY_LANE_HEIGHT = 32;
const CARD_GAP = 8;

type Card = { key: string; face: 'good' | 'wallet' | 'sale'; icon?: 'apple' | 'cookie' | 'book' | 'plant' | 'balloon' | 'cupcake' | 'bag'; tag: string; coin?: number };

/** Row A: the goods, then a sale card and a wallet when the story has them. All cards are alike. */
function shelfCards(model: MoneyModel, money: (n: number) => string, unknown: string): Card[] {
  const icon = model.items?.[0] ?? 'apple';
  if (model.task === 'unit') return Array.from({ length: model.quantities[0] }, (_, i) => ({ key: `u${i}`, face: 'good', icon, tag: unknown }));
  const goods = model.prices.map<Card>((price, i) => ({
    key: `g${i}`, face: 'good', icon: model.items?.[i] ?? 'apple', coin: model.coins ? price : undefined,
    tag: model.quantities[i] > 1 ? `${model.quantities[i]} × ${money(price)}` : money(price),
  }));
  if (model.discount > 0) goods.push({ key: 'sale', face: 'sale', tag: `−${model.discount}%` });
  if (model.task === 'afford' || model.task === 'change') goods.push({ key: 'wallet', face: 'wallet', icon: 'bag', tag: money(model.paid) });
  return goods;
}

function cardSize(count: number, width: number) {
  return Math.min(104, Math.floor((width - CARD_GAP * (count - 1)) / count));
}

export function MoneyShelf({ model, unknown = '?' }: { model: MoneyModel; unknown?: string }) {
  const { locale } = useLocale();
  const width = useMoneyWidth();
  const money = (n: number) => formatPriceTicket(n, model.unit, locale);
  const cards = shelfCards(model, money, unknown);
  const size = cardSize(cards.length, width);
  return <View accessible accessibilityRole="image" accessibilityLabel={model.label} testID="money-shelf" style={styles.shelf}>
    {cards.map(card => <View key={card.key} style={[styles.card, { width: size }, card.face === 'wallet' && styles.walletCard]}>
      {card.face === 'sale'
        ? <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.sale}>{card.tag}</Text>
        : card.coin !== undefined ? <MoneyCoin value={card.coin} />
          : card.icon && <MoneyDiagramIcon name={card.icon} size={40} />}
      {card.face !== 'sale' && card.coin === undefined && <View style={[styles.tag, card.face === 'wallet' && styles.walletTag]}>
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.tagText}>{card.tag}</Text>
      </View>}
    </View>)}
  </View>;
}

/**
 * The label lane above the tape. Reserved even when empty. A whole-tape amount (teal) is ONE soft band exactly the tape's
 * width with its label centred, never a chip floating at the end; an amber over/under label stays a pill over the amber part.
 */
export function MoneyLane({ label, tone = 'teal', width }: { label?: string; tone?: 'teal' | 'amber'; width?: number }) {
  // A band is exactly the width of what it measures: the whole tape, or `width` from its left edge.
  return <View style={styles.lane}>
    {!!label && <View style={tone === 'teal' ? [styles.band, width !== undefined && { alignSelf: 'flex-start', width }] : [styles.pill, { backgroundColor: Quantity[tone].light }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.laneText}>{label}</Text>
    </View>}
  </View>;
}

/** The money row: the purse before Check, the tape after. Same size and place both times. */
export function MoneyZone({ children, padded = false }: { children?: ReactNode; padded?: boolean }) {
  return <View style={[styles.zone, padded && styles.zonePadded]}>{children}</View>;
}

/** The child's answer before Check: one card, centred in the money row, "?" until a choice is picked. */
function MoneyPocket({ icon, label, size }: { icon: ComponentProps<typeof MoneyDiagramIcon>['name']; label: string; size: number }) {
  return <View style={[styles.card, styles.pocketCard, { width: size }]} testID="money-pocket" accessible accessibilityLabel={label}>
    <MoneyDiagramIcon name={icon} size={40} />
    <View style={[styles.tag, styles.pocketTag]}>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.tagText}>{label}</Text>
    </View>
  </View>;
}

export function MoneyStage({ model, id, unknown, lane, zone, pocket }: {
  model: MoneyModel; id: string; unknown?: string; lane?: ReactNode; zone?: ReactNode; pocket?: { icon: ComponentProps<typeof MoneyDiagramIcon>['name']; label: string };
}) {
  const { locale } = useLocale();
  const width = useMoneyWidth();
  const count = shelfCards(model, n => formatPriceTicket(n, model.unit, locale), '?').length;
  return <View nativeID={id} testID={id} style={[styles.stage, { width }]}>
    <MoneyShelf model={model} unknown={unknown} />
    {(zone !== undefined || !!pocket) && <View style={[styles.money, !!pocket && styles.pocketRow]}>
      {lane}{zone}
      {pocket && <View pointerEvents="none" style={styles.pocketHolder}><MoneyPocket icon={pocket.icon} label={pocket.label} size={cardSize(count, width)} /></View>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'center', gap: 8, paddingVertical: 4 },
  shelf: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: CARD_GAP },
  card: { height: MONEY_CARD_HEIGHT, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Quantity.amber.soft },
  walletCard: { backgroundColor: Quantity.teal.soft },
  tag: { minWidth: 44, minHeight: 28, maxWidth: '96%', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Quantity.amber.light },
  walletTag: { backgroundColor: Quantity.teal.light },
  laneText: { fontSize: 20, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  tagText: { fontSize: 18, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  sale: { maxWidth: '90%', fontSize: 24, fontWeight: '900', color: Quantity.amber.onFill },
  money: { gap: 4 },
  pocketRow: { height: MONEY_LANE_HEIGHT + 4 + MONEY_ZONE_HEIGHT },
  pocketHolder: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' },
  pocketCard: { backgroundColor: Quantity.violet.soft },
  pocketTag: { backgroundColor: Quantity.violet.light },
  lane: { height: MONEY_LANE_HEIGHT, alignItems: 'flex-end', justifyContent: 'center' },
  band: { alignSelf: 'stretch', height: MONEY_LANE_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Quantity.teal.soft },
  pill: { minWidth: 44, height: MONEY_LANE_HEIGHT, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  zone: { height: MONEY_ZONE_HEIGHT, borderRadius: 14, overflow: 'hidden', backgroundColor: Quantity.teal.soft },
  zonePadded: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, overflow: 'visible' },
});
