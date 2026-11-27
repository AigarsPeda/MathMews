import { GridDiagram } from '@/components/puzzle/GridDiagram';
import { BarChart, type BarControls } from '@/components/puzzle/BarChart';
import { MoneyReveal } from '@/components/puzzle/MoneyReveal';
import { MoneyPurse } from './everyday/MoneyPurse';
import type { MoneyInput } from '@/utils/puzzle-money';
import { JugPour } from '@/components/puzzle/JugPour';
import type { CapacityInput, CapacityAttempt } from '@/utils/puzzle-capacity';
import type { ClockInput, ClockAttempt } from '@/utils/puzzle-clock';
import { ClockDiagram } from '@/components/puzzle/ClockDiagram';
import { VolumeBox } from '@/components/puzzle/VolumeBox';
import { ShapeDiagram } from '@/components/puzzle/ShapeDiagram';
import type { EverydayModel } from '@/types/everyday';


/** Diagrams show givens, never the selected answer or an unrequested solution. */
export function EverydayDiagram({ model, onSolutionShown, onSelectGroup, selectedGroup, submitted, clockInput, clockAttempt, elapsedUnit, capacityInput, capacityAttempt, moneyInput, moneyAttempt }: BarControls & { model: EverydayModel; moneyInput?: MoneyInput; moneyAttempt?: { choice?: string }; capacityInput?: CapacityInput; capacityAttempt?: CapacityAttempt; clockInput?: ClockInput; clockAttempt?: ClockAttempt; elapsedUnit?: ClockInput['elapsedUnit']; onSolutionShown?: () => void }) {

  if (model.kind === 'clock') {
    return <ClockDiagram model={model} clockInput={clockInput} clockAttempt={clockAttempt} elapsedUnit={elapsedUnit} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'bars') {
    return <BarChart onSelectGroup={onSelectGroup} selectedGroup={selectedGroup} submitted={submitted} key={JSON.stringify(model)} model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'shapes') {
    return <ShapeDiagram model={model} submitted={submitted} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'grid') {
    return <GridDiagram model={model} onSolutionShown={onSolutionShown} />;
  } else if (model.kind === 'money') {
    if (onSolutionShown) return <MoneyReveal model={model} input={moneyInput} attempt={moneyAttempt} onSolutionShown={onSolutionShown} />;
    return <MoneyPurse key={JSON.stringify(model)} model={model} input={moneyInput} />;
  } else if (model.kind === 'capacity') {
    return <JugPour key={JSON.stringify(model)} model={model} capacityInput={capacityInput} capacityAttempt={capacityAttempt} onSolutionShown={onSolutionShown} />;
  } else {
    return <VolumeBox model={model} submitted={submitted} onSolutionShown={onSolutionShown} />;
  }
}
