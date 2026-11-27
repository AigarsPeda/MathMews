import { useLocale } from '@/contexts/LocaleProvider';
import { formatPriceTicket, trialValue, type MoneyInput, type MoneyModel } from '@/utils/puzzle-money';
import { MoneyLane, MoneyStage } from './MoneyStage';

export function MoneyPurse({ model, input }: { model: MoneyModel; input?: MoneyInput }) {
  const { locale } = useLocale();
  const index = input?.selectedIndex ?? null;
  const picked = index === null ? undefined : trialValue(model, input?.choices[index]);
  const isCount = model.task === 'afford';
  const label = picked === undefined ? '?' : isCount ? String(picked) : formatPriceTicket(picked, model.unit, locale);
  const icon = isCount || model.task === 'unit' ? (model.items?.[0] ?? 'apple') : 'bag';
  // The unit pack's price is a given, so it waits in the lane where the tape's end label will be.
  const lane = <MoneyLane label={model.task === 'unit' ? formatPriceTicket(model.prices[0], model.unit, locale) : undefined} />;
  return <MoneyStage model={model} id="play-entry-model" lane={input ? lane : undefined} pocket={input ? { icon, label } : undefined} />;
}
