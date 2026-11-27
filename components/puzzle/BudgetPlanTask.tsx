import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { layoutTape, type TapeSegment } from '@/utils/money-tape';
import { useMoneyWidth } from './everyday/MoneyStage';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { useLocale } from '@/contexts/LocaleProvider';
import type { BudgetPlanPuzzle } from '@/types/puzzle';
import type { ChallengeAnswer } from '@/utils/challenge-puzzles';
import { PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from './PuzzleDragBoard';
import { PuzzleText as Text } from './PuzzleText';
import { PaintedModel } from './everyday/PaintedModel';
import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { ShoppingLane } from './everyday/ShoppingLane';
import { MoneyDiagramIcon } from './MoneyCoin';
import { EntryBuild, IdleHint } from './kit/PracticeAffordances';
import { ProofCaption } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';
import { useProofAnnouncement } from './counting/useProofAnnouncement';

type BudgetAnswer = Extract<ChallengeAnswer, { kind: 'budget' }>;
type Good = BudgetPlanPuzzle['payload']['items'][number];
type BudgetTaskProps = {
  puzzle: BudgetPlanPuzzle; answered: boolean;
  onAnswerChange: (answer: ChallengeAnswer | null) => void;
  onDragStateChange: (dragging: boolean) => void; initialIndices?: readonly number[];
};
type Playback = { at: SharedValue<number>; landed: number };
function net(item: Good) {
  'worklet';
  return Math.round(item.price * (100 - item.discountPercent)) / 100;
}
const noop = () => {};
let demonstratedBasket = false;
const clamp = (n: number) => { 'worklet'; return Math.max(0, Math.min(1, n)); };
const lerp = (a: number, b: number, t: number) => { 'worklet'; return a + (b - a) * t; };
const SEAM = 4;
const CARD = 92;

/** One basket slot. In the proof it becomes a tape segment: equal slot, then its gross price, then its discounted price. */
function BasketSlot({ index, equal, gross, discounted, proof, children }: {
  index: number; equal: number; gross: number; discounted: number; proof?: Playback; children: React.ReactNode;
}) {
  const at = proof?.at;
  const motion = useAnimatedStyle(() => {
    if (!at) return { width: equal + SEAM };
    const p = at.value;
    const w = p < 1 ? lerp(equal, gross, clamp(p)) : lerp(gross, discounted, clamp(p - 1 - index));
    return { width: w + SEAM };
  });
  return <Animated.View style={[styles.slot, motion]}>{children}</Animated.View>;
}

/** The part of the budget that is not spent: Keep (violet), and ONE amber segment if it is not exactly the keep amount. */
function Remainder({ index, width, tone, label, short, proof, count }: {
  index: number; width: number; tone: 'violet' | 'amber'; label: string; short: string; proof: Playback; count: number;
}) {
  const motion = useAnimatedStyle(() => ({ width: (width + SEAM) * clamp((proof.at.value - 1) / Math.max(1, count - 1)) }));
  const text = useAnimatedStyle(() => ({ opacity: clamp(proof.at.value - count + 1) }));
  return <Animated.View key={index} style={[styles.slot, styles.remainderSlot, motion]} accessible accessibilityLabel={label}>
    <View style={[styles.remainder, { backgroundColor: Quantity[tone].edge }]}>
      <View style={[styles.remainderFace, { backgroundColor: Quantity[tone].fill }]}>
        {/* Same card grammar as the goods: the wallet glyph above, the amount on a soft chip below. */}
        <Animated.View style={[styles.face, text]}>
          <MoneyDiagramIcon name="bag" size={40} />
          <View style={[styles.tag, { backgroundColor: Quantity[tone].soft }]}><Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.priceText}>{width >= 84 ? label : short}</Text></View>
        </Animated.View>
      </View>
    </View>
  </Animated.View>;
}

export function BudgetPlanTask({ puzzle, answered, onAnswerChange, onDragStateChange, initialIndices = [], proof }: BudgetTaskProps & { proof?: Playback }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const width = useMoneyWidth();
  const { items, pickCount, budget, remaining } = puzzle.payload;
  const [selected, setSelected] = useState<readonly number[]>(initialIndices);
  const basket = t('everyday.basket');
  const keep = `${t('challenges.budgetKeep')} ${remaining}`;
  const sharedDiscount = items.every(item => item.discountPercent === items[0].discountPercent) ? items[0]?.discountPercent : undefined;
  const ownDiscounts = sharedDiscount === undefined && items.some(item => item.discountPercent > 0);
  const cardHeight = CARD + (ownDiscounts ? 18 : 0);
  const [touched, setTouched] = useState(false);
  const [first] = useState(() => !demonstratedBasket);
  const [shopRect, setShopRect] = useState<LayoutRectangle>();
  const [basketRect, setBasketRect] = useState<LayoutRectangle>();
  const [firstTile, setFirstTile] = useState<LayoutRectangle>();
  const ready = !!(shopRect && basketRect);
  const perRow = Math.min(4, Math.max(1, items.length));
  const cardWidth = Math.floor((width - 8 * (perRow - 1)) / perRow);
  useEffect(() => {
    if (!ready || touched || !first || proof) return;
    const timer = setTimeout(() => { demonstratedBasket = true; }, 5100);
    return () => clearTimeout(timer);
  }, [ready, touched, first, proof]);
  const handleDragState = useCallback((dragging: boolean) => {
    if (dragging) { demonstratedBasket = true; setTouched(true); }
    onDragStateChange(dragging);
  }, [onDragStateChange]);
  function move(source: string, target: string) {
    const index = Number(source), include = target === 'basket';
    if (answered || !items[index] || (!include && target !== 'shop') || selected.includes(index) === include) return;
    if (include && selected.length >= pickCount) return;
    const next = include ? [...selected, index] : selected.filter(i => i !== index);
    demonstratedBasket = true; setTouched(true); setSelected(next);
    onAnswerChange(next.length === pickCount ? { kind: 'budget', indices: next } : null);
  }
  const number = (v: number) => v.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 2 });
  function good(i: number, chosen: boolean, slot = -1) {
    const item = items[i];
    const value = chosen && proof && proof.landed >= slot + 2 ? net(item) : item.price;
    const label = number(value);
    const price = t('challenges.price', { price: label });
    const discount = item.discountPercent ? t('challenges.discount', { percent: item.discountPercent }) : t('challenges.noDiscount');
    const destination = chosen ? 'shop' : 'basket';
    const face = <View style={styles.face}>
      {item.object && <MoneyDiagramIcon name={item.object} size={40} />}
      <View style={[styles.tag, chosen && styles.chosenTag]}><Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.priceText}>{label}</Text></View>
      {ownDiscounts && <Text style={styles.ownDiscount}>{item.discountPercent > 0 ? `−${item.discountPercent}%` : ' '}</Text>}
    </View>;
    const style = chosen ? [styles.tile, styles.chosen, { height: cardHeight }] : [styles.tile, { width: cardWidth, height: cardHeight }];
    if (proof) return <View key={i} style={style} accessible accessibilityLabel={`${item.label}, ${price}`}>{face}</View>;
    return <View key={i} onLayout={i === 0 && !chosen ? e => setFirstTile(e.nativeEvent.layout) : undefined} style={chosen && styles.fill}>
      <EntryBuild index={i} ready={ready} style={chosen && styles.fill}><PuzzleDragTile compact id={String(i)} label={String(item.price)} disabled={answered} selected={chosen} style={style} face={face}
        onPress={() => move(String(i), destination)} accessibilityLabel={[item.label, price, discount, chosen && basket].filter(Boolean).join(', ')}
        accessibilityHint={t('challenges.budgetToggle')} actions={[{ id: destination, label: t(chosen ? 'challenges.removeGood' : 'challenges.addGood') }]} /></EntryBuild>
    </View>;
  }
  const chosen = selected.map(i => items[i]);
  const at = proof?.at;
  // Tape geometry: equal slots, then gross prices, then discounted prices with the keep and amber segments after them.
  const spend = chosen.reduce((sum, item) => sum + net(item), 0);
  const rest = Math.round((budget - spend) * 100) / 100;
  const complete = chosen.length === pickCount;
  const tail: TapeSegment[] = !complete ? [] : rest >= remaining
    ? [{ value: remaining, label: keep, tone: 'violet' }, ...(rest > remaining ? [{ value: rest - remaining, label: `+${number(rest - remaining)}`, tone: 'amber' as const }] : [])]
    : [...(rest > 0 ? [{ value: rest, label: number(rest), tone: 'violet' as const }] : []), { value: remaining - Math.max(rest, 0), label: `−${number(remaining - Math.max(rest, 0))}`, tone: 'amber' }];
  const finalPlan = layoutTape({ segments: [...chosen.map(item => ({ value: net(item), label: '', tone: 'teal' as const })), ...tail], unfilled: 0 }, width);
  const grossSpend = chosen.reduce((sum, item) => sum + item.price, 0);
  const grossPlan = layoutTape({ segments: chosen.map(item => ({ value: item.price, label: '', tone: 'teal' as const })), unfilled: Math.max(0, budget - grossSpend) }, width);
  const equal = (width - SEAM * (pickCount - 1)) / pickCount;
  const extent = spend + tail.reduce((sum, seg) => sum + seg.value, 0);
  const lane = useAnimatedStyle(() => ({ opacity: clamp((at?.value ?? 0) - 1) }));
  const modelID = proof ? 'play-proof-model' : 'play-entry-model';
  return <View testID={modelID} nativeID={modelID} style={[styles.wrap, { width }]}>
    <PuzzleDragBoard floatingStyle={[styles.tile, { width: cardWidth, height: cardHeight }]} onDrop={move} onDragStateChange={handleDragState}>
      <ShoppingLane position={at} hidden={!!proof?.landed}>
        <View onLayout={e => setShopRect(e.nativeEvent.layout)}>
          <PuzzleDropArea fillOnly id="shop" label={t('challenges.removeGood')} style={styles.shop}>
            <View style={styles.givens} accessible accessibilityLabel={t('challenges.budgetGoal', { budget, count: pickCount, remaining })}>
              <View style={[styles.given, styles.wallet]}><MoneyDiagramIcon name="bag" size={26} /><Text style={styles.priceText}>{budget}</Text></View>
              <View style={[styles.given, styles.keep]}><Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.priceText}>{keep}</Text></View>
              {!!sharedDiscount && <View style={[styles.given, styles.sale]}><Text style={styles.discount}>−{sharedDiscount}%</Text></View>}
            </View>
            {items.map((_, i) => !selected.includes(i) && good(i, false))}
          </PuzzleDropArea>
        </View>
      </ShoppingLane>
      <View onLayout={e => setBasketRect(e.nativeEvent.layout)}>
        <View style={styles.lane}>{!!proof && <Animated.View style={[styles.band, lane]}><MoneyDiagramIcon name="bag" size={20} /><Text style={styles.priceText}>{number(extent)}</Text></Animated.View>}</View>
        <View>
          <PuzzleDropArea fillOnly id="basket" label={basket} style={styles.basket}>
            {Array.from({ length: Math.max(pickCount, selected.length) }, (_, slot) => {
              const i = selected[slot], item = items[i];
              return <BasketSlot key={slot} index={slot} equal={equal} gross={grossPlan[slot]?.width ?? equal} discounted={finalPlan[slot]?.width ?? equal} proof={proof}>
                {item ? good(i, true, slot) : <View style={[styles.emptySlot, { height: cardHeight }]} />}
              </BasketSlot>;
            })}
            {proof && tail.map((seg, k) => <Remainder key={k} index={k} width={finalPlan[chosen.length + k]?.width ?? 0} tone={seg.tone as 'violet' | 'amber'}
              label={seg.label} short={seg.tone === 'violet' && seg.label === keep ? number(remaining) : seg.label} proof={proof} count={1 + chosen.length} />)}
          </PuzzleDropArea>
        </View>
      </View>
      {!proof && shopRect && basketRect && firstTile && <IdleHint movable={!answered} firstEncounter={first} interacted={touched || selected.length > 0}
        from={{ x: shopRect.x + firstTile.x + firstTile.width / 2, y: shopRect.y + firstTile.y + firstTile.height / 2 }}
        to={{ x: basketRect.x + basketRect.width / (2 * pickCount), y: basketRect.y + 28 + cardHeight / 2 }} />}
    </PuzzleDragBoard>
  </View>;
}

export function BudgetPlanReveal({ puzzle, answer, onSolutionShown }: { puzzle: BudgetPlanPuzzle; answer: BudgetAnswer; onSolutionShown: () => void }) {
  const { locale } = useLocale();
  const { budget, items } = puzzle.payload;
  const costs = answer.indices.map(i => net(items[i]));
  const count = 1 + costs.length;
  const beats = useRevealBeats(count, { awaitInitialPaint: true, onDone: onSolutionShown, reducedSteps: true, minTotal: 0, lead: 60, step: 440, hold: i => i === count ? 100 : 0 });
  const { landed, reduced, position } = beats;
  const at = useDerivedValue(() => reduced ? landed : position.value);
  const number = (v: number) => v.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 2 });
  const formula = [budget, ...costs].map(number).join(' − ') + ' = ' + number(costs.reduce((left, price) => left - price, budget));
  const purchase = items[answer.indices[Math.max(0, landed - 2)]];
  useProofAnnouncement(beats, landed === count ? formula : purchase ? `${purchase.label}, ${number(landed > 1 ? net(purchase) : purchase.price)}` : '', true);
  return <RevealSurface beats={beats}><PaintedModel beats={beats}>
    <BudgetPlanTask puzzle={puzzle} initialIndices={answer.indices} answered onAnswerChange={noop} onDragStateChange={noop} proof={{ at, landed }} />
    <ProofEquationSlot settled={beats.settled}><ProofCaption text={landed === count ? formula : ''} /></ProofEquationSlot>
  </PaintedModel></RevealSurface>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', paddingVertical: 6 },
  givens: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  given: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 6 },
  wallet: { backgroundColor: Quantity.teal.soft },
  keep: { backgroundColor: Quantity.violet.soft },
  sale: { backgroundColor: Quantity.amber.soft },
  shop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tile: { paddingVertical: 4, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderBottomWidth: 3, borderColor: Quantity.amber.edge, backgroundColor: Quantity.amber.light, borderRadius: 12 },
  chosen: { width: '100%', backgroundColor: Quantity.teal.fill, borderColor: Quantity.teal.edge },
  fill: { width: '100%' },
  face: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  tag: { minWidth: 44, minHeight: 28, maxWidth: '100%', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Quantity.amber.soft },
  chosenTag: { backgroundColor: Quantity.teal.soft },
  ownDiscount: { fontSize: 14, fontWeight: '800', color: Quantity.amber.onFill },
  discount: { color: Quantity.amber.onFill, fontSize: 18, fontWeight: '900' },
  basket: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: -SEAM / 2 },
  slot: { paddingHorizontal: SEAM / 2, overflow: 'hidden' },
  emptySlot: { width: '100%', borderRadius: 12, backgroundColor: Quantity.teal.soft },
  remainderSlot: { alignSelf: 'stretch' },
  remainder: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  remainderFace: { flex: 1, marginBottom: 3, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lane: { height: 28, justifyContent: 'center', marginBottom: 4 },
  // The whole wallet spans the whole tape: one soft band, exactly the tape's width, label centred.
  band: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Quantity.teal.soft },
  priceText: { fontSize: 16, color: Ink.text, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
