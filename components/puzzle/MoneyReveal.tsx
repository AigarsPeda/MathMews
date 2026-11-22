import { dropHeight } from '@/utils/puzzle-motion';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { AppIcon } from '@/components/ui/AppIcon';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import { useLocale } from '@/contexts/LocaleProvider';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { formatPuzzleMoney, moneyPurchase, type MoneyModel } from '@/utils/puzzle-money';
import { MoneyCoin } from './MoneyCoin';
import { PuzzleText as Text } from './PuzzleText';

const CountedCoin = memo(function CountedCoin({ value, arrival, time }: { value: number; arrival: number; time: SharedValue<number> }) {
  const motion = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (time.value - arrival + .7) / .7));
    const lift = dropHeight(p);
    return { opacity: Math.min(1, p * 3), transform: [{ translateY: -20 * lift }, { translateX: 7 * lift }, { rotate: `${12 * lift}deg` }] };
  });
  return <Animated.View style={motion}><MoneyCoin value={value} /></Animated.View>;
});

export function MoneyReveal({ model, onSolutionShown }: { model: MoneyModel; onSolutionShown: () => void }) {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const { price, subtotal, saving, itemCount, change, priceCoins, changeCoins } = useMemo(() => moneyPurchase(model), [model]);
  const money = (value: number) => formatPuzzleMoney(value, model.unit, locale);
  const time = useSharedValue(0);
  const [step, setStep] = useState(0);
  // Hold the exact price before starting a fresh count for the returned coins.
  const changeStart = priceCoins.length + 3;
  const end = change === null ? priceCoins.length : changeStart + changeCoins.length;
  const returning = change !== null && step >= changeStart;
  const done = step >= end;
  useAnimatedReaction(() => Math.floor(time.value), (current, previous) => {
    if (current !== previous) scheduleOnRN(setStep, current);
  });
  useEffect(() => {
    if (time.value >= end) return;
    if (reduceMotion || !active) { time.value = end; return; }
    const beat = Math.min(410, Math.max(190, 4500 / Math.max(end, 1)));
    time.value = withTiming(end, { duration: end * beat, easing: Easing.linear });
    return () => cancelAnimation(time);
  }, [time, end, active, reduceMotion]);
  useEffect(() => { if (done) onSolutionShown(); }, [onSolutionShown, done]);

  const coins = returning ? changeCoins : priceCoins;
  const offset = returning ? changeStart : 0;
  const counted = coins.slice(0, Math.max(0, step - offset)).reduce((sum, coin) => sum + coin, 0);
  const terms = model.prices.map((p, i) => model.quantities[i] > 1 ? `${model.quantities[i]} × ${money(p)}` : money(p));
  const priceExpression = model.task === 'unit' ? `${money(model.prices[0])} ÷ ${model.quantities[0]}`
    : model.task === 'afford' ? `${itemCount} × ${money(model.prices[0])}`
    : saving ? `${money(subtotal)} − ${money(saving)}` : terms.join(' + ');
  const equation = returning ? `${money(model.paid)} − ${money(price)} = ${money(change!)}` : `${priceExpression} = ${money(price)}`;
  const stageKey = returning ? model.task === 'afford' ? 'left' : 'change'
    : model.coins ? 'total' : model.task === 'unit' ? 'each' : saving ? 'sale' : 'price';
  const heading = t(`moneyReveal.${stageKey}`);
  // Reserve enough room for either set so the basket and total stay put during the switch.
  const slots = Math.max(priceCoins.length, changeCoins.length);
  return <View style={styles.wrap}>
    <View style={styles.basket}>
      {model.items?.map((item, i) => {
        const quantity = model.task === 'afford' ? itemCount : model.quantities[i];
        const tag = model.task === 'unit' ? priceExpression : quantity > 1 ? `${quantity} × ${money(model.prices[i])}` : money(model.prices[i]);
        return <View key={i} accessible accessibilityLabel={`${t('everyday.shopItems.' + item)}, ${tag}`} style={styles.item}>
          <AppIcon name={item} size={32} />
          <Text style={styles.tag}>{tag}</Text>
        </View>;
      })}
      {saving > 0 && <Text style={styles.tag}>{t('everyday.discount', { percent: model.discount })}</Text>}
    </View>
    <View style={[styles.tray, returning && styles.changeTray]}>
      <View style={styles.header}>
        <Text testID={returning ? 'money-change-stage' : 'money-price-stage'} style={styles.heading}>{heading}</Text>
        <Text style={styles.amount}>{money(counted)}</Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.coins}>
        {Array.from({ length: slots }, (_, i) => i < coins.length
          ? <CountedCoin key={i} time={time} arrival={offset + i + 1} value={coins[i]} />
          : <View key={i} style={styles.empty} />)}
      </View>
    </View>
    {change !== null && <View style={styles.receipt}>
      <Text style={styles.detail}>{t(model.task === 'afford' ? 'moneyReveal.budget' : 'moneyReveal.paid')} {money(model.paid)}</Text>
      {returning && <Text style={styles.detail}>{t('moneyReveal.price')} {money(price)}</Text>}
    </View>}
    <View style={styles.caption}>
      {(done || !returning && step >= priceCoins.length) && <Text testID={done ? 'money-solution-caption' : undefined} accessibilityLiveRegion="polite" style={styles.equation}>{equation}</Text>}
      {model.task === 'afford' && done && <Text style={styles.detail}>{t('moneyReveal.itemCount', { value: itemCount })}</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 370, alignSelf: 'center', paddingVertical: 6, gap: 8 },
  basket: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 18, rowGap: 4 },
  item: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  tag: { fontSize: 16, fontWeight: '800', color: C.text },
  tray: { backgroundColor: '#FFFAEE', borderWidth: 1.5, borderColor: '#E9CC91', borderRadius: 16, padding: 12, gap: 10 },
  changeTray: { backgroundColor: '#EFF8F3', borderColor: '#A6CBBA' },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8 },
  heading: { color: C.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  amount: { color: C.text, fontWeight: '900', fontSize: 25, fontVariant: ['tabular-nums'] },
  coins: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', minHeight: 43 },
  empty: { width: 43, height: 43 },
  receipt: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18 },
  detail: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: C.textMuted, textAlign: 'center' },
  caption: { minHeight: 29, alignItems: 'center' },
  equation: { color: C.primaryDark, textAlign: 'center', fontSize: 21, lineHeight: 29, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
