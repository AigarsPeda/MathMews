import { useContext, useState } from 'react';
import { View } from 'react-native';
import type { QuantityTaskModel } from '@/types/puzzle';
import { quantityEquation } from '@/utils/quantity-task-scene';
import { QuantityStage } from './counting/QuantityStage';
import { ArrayBoard } from './counting/ArrayBoard';
import { CountingTrays } from './counting/CountingTrays';
import { TransferBoard } from './counting/TransferBoard';
import { canSnapshotCanvas } from './counting/useModelPaint';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { QuantityEquation } from './counting/QuantityEquation';
import { HelpProofContext } from './kit/HelpProofContext';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';

type BoardProps = {
  model: Exclude<QuantityTaskModel, {kind: 'share'}>; running: boolean; solved?: boolean; interactive?: boolean; selectedGroups?: number;
  showExpression: boolean; description: string; onSolutionShown?: () => void;
};
export function CountingBoard(props: BoardProps) {
  const {model} = props;
  if (model.kind === 'array') return <ArrayScene {...props} model={model} />;
  return model.left + (model.kind === 'join' ? model.right : 0) <= 20
    ? <TransferBoard {...props} model={model} /> : <CountingTrays {...props} model={model} />;
}
function ArrayScene({model, running, interactive, onSolutionShown, description}: BoardProps & {model: Extract<QuantityTaskModel, {kind: 'array'}>}) {
  const [width, setWidth] = useState(0);
  const help = useContext(HelpProofContext);
  const beats = useRevealBeats(running ? width ? model.rows : null : 0, {awaitInitialPaint: running && canSnapshotCanvas,
    lead: 20, step: help ? Math.min(650, Math.floor(3300 / model.rows)) : Math.min(180, Math.floor(3300 / model.rows)), hold: 0, minTotal: 0, reducedSteps: true, onDone: onSolutionShown});
  const equation = quantityEquation(model, model.rows, undefined, true);
  useProofAnnouncement(beats, beats.settled ? equation : String(beats.landed * model.columns), running);
  const body = <View onLayout={e => setWidth(e.nativeEvent.layout.width)} testID="practice-board">
    <QuantityStage model="array" locked={!interactive}><View collapsable={false} accessible={!interactive} accessibilityRole={interactive ? undefined : 'image'} accessibilityLabel={description}
      nativeID={running ? 'play-proof-model' : 'play-entry-model'} testID={running ? 'play-proof-model' : 'play-entry-model'}>
      <ArrayBoard beats={running && width ? beats : undefined} measuredWidth={width} {...{model, running, interactive}} landed={beats.landed} />
    </View></QuantityStage>
    {running && <QuantityEquation large={!!help} text={equation} settled={beats.settled} />}
  </View>;
  return running ? <RevealSurface beats={beats}>{body}</RevealSurface> : body;
}
