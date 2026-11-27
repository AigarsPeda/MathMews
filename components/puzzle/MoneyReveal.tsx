import { useDerivedValue } from 'react-native-reanimated';
import { View } from 'react-native';
import { useLocale } from '@/contexts/LocaleProvider';
import { comparePurse, formatPriceTicket, formatPuzzleMoney, moneyPurchase, trialValue, type MoneyModel, type MoneyInput } from '@/utils/puzzle-money';
import { planMoneyTape } from '@/utils/money-tape';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { PaintedModel } from './everyday/PaintedModel';
import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { MoneyLane, MoneyStage, MoneyZone, useMoneyWidth } from './everyday/MoneyStage';
import { keptWidth, SaleLane, SaleStrip, TapeLane, TapeSegments } from './everyday/MoneyTape';
import { ProofCaption } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';

/**
 * Check turns the purse into the tape, in the same place and at the same width, directly under the same shelf.
 * A miss is drawn on that tape: the child's amount, with the over- or under-part as ONE amber segment.
 */
export function MoneyReveal({ model, onSolutionShown, attempt }: {
  model: MoneyModel; onSolutionShown: () => void; input?: MoneyInput; attempt?: { choice?: string };
}) {
  const { locale } = useLocale();
  const width = useMoneyWidth();
  const { price, subtotal, saving, change, itemCount } = moneyPurchase(model);
  const submitted = attempt ? trialValue(model, attempt.choice) : undefined;
  const missed = attempt !== undefined && submitted !== undefined;
  const sale = model.task === 'discount';
  const money = (n: number) => (model.task === 'unit' || attempt ? formatPriceTicket : formatPuzzleMoney)(n, model.unit, locale);
  const comparison = missed ? comparePurse(model, submitted, locale) : undefined;
  const terms = model.prices.map((p, i) => model.quantities[i] === 1 ? money(p) : `${model.quantities[i]} × ${money(p)}`);
  const equation = attempt ? comparison?.caption ?? '' : model.task === 'afford' ? `${itemCount} × ${money(model.prices[0])} = ${money(price)}`
    : model.task === 'unit' ? `${money(subtotal)} ÷ ${itemCount} = ${money(price)}`
    : model.task === 'discount' ? `${money(subtotal)} − ${money(saving)} = ${money(price)}`
    : model.task === 'change' ? `${money(model.paid)} − ${money(price)} = ${money(change!)}`
    : terms.length === 1 && model.quantities[0] === 1 ? money(price) : `${terms.join(' + ')} = ${money(price)}`;
  const plan = sale ? undefined : planMoneyTape(model, missed ? submitted : undefined, locale);
  const count = sale ? 3 : Math.max(1, plan!.segments.length);
  const beats = useRevealBeats(count, { awaitInitialPaint: true, onDone: onSolutionShown, reducedSteps: true,
    lead: 80, step: Math.min(500, 3400 / count), hold: i => i === count ? 100 : 0, minTotal: 0 });
  const { position, reduced, landed } = beats;
  const at = useDerivedValue(() => reduced ? landed : position.value);
  const stepLabel = sale ? `${money(subtotal)} − ${model.discount}%` : plan!.segments.slice(0, landed).map(s => s.label).join(' + ');
  useProofAnnouncement(beats, beats.settled ? equation : stepLabel, true);
  const over = missed && submitted > price;
  const kept = sale ? keptWidth(model.discount, width) : undefined;
  const lane = sale ? missed ? <MoneyLane label={formatPriceTicket(price, model.unit, locale)} width={kept} />
      : <SaleLane from={formatPriceTicket(subtotal, model.unit, locale)} to={formatPriceTicket(price, model.unit, locale)} at={at} toWidth={kept} />
    : <TapeLane label={formatPriceTicket(plan!.extent, model.unit, locale)} at={at} beats={count} />;
  const zone = <MoneyZone>
    {sale ? <SaleStrip percent={model.discount} width={width} at={at} miss={missed && submitted !== price ? over ? 'over' : 'under' : undefined} />
      : <TapeSegments plan={plan!} width={width} at={at} />}
  </MoneyZone>;
  return <RevealSurface beats={beats} replayable><PaintedModel beats={beats}>
    <MoneyStage model={model} id="play-proof-model" unknown={model.task === 'unit' && !missed && landed >= count ? money(price) : '?'}
      lane={lane} zone={zone} />
    <ProofEquationSlot settled={beats.settled}><View testID="money-solution-caption"><ProofCaption text={landed === count ? equation : ''} /></View></ProofEquationSlot>
  </PaintedModel></RevealSurface>;
}
