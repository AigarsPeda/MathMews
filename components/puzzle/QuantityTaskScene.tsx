import { useTranslation } from 'react-i18next';
import type { QuantityTaskModel } from '@/types/puzzle';
import { CountingBoard } from './CountingBoard';
import { ShareProof } from './counting/ShareProof';
import { SharingTable } from './counting/SharingTable';

export function QuantityTaskScene({ model, disabled, showExpression = true, selectedGroups, onSolutionShown, solved = !!onSolutionShown, initialDistribution, onDistributionChange }: {
  model: QuantityTaskModel; disabled: boolean; showExpression?: boolean; selectedGroups?: number; solved?: boolean;
  initialDistribution?: readonly number[]; onSolutionShown?: () => void; onDistributionChange?: (locations: number[]) => void;
}) {
  const { t } = useTranslation();
  if (model.kind === 'share' && solved) return <ShareProof {...model} {...{selectedGroups, onSolutionShown}} initialLocations={initialDistribution} />;
  if (model.kind === 'share') return <SharingTable selectedGroups={selectedGroups} key={model.items + '-' + model.groups}
    initialLocations={initialDistribution} object={model.object} items={model.items} groups={model.groups} disabled={disabled} onDistributionChange={onDistributionChange} />;
  const description = model.kind === 'array' ? t('objectScenes.arrayReady', {
    rows: model.rows, columns: model.columns, objects: model.object ? t('taskObjects.' + model.object) : t('countingScene.objects'),
  }) : '';
  return <CountingBoard key={solved ? 'solution' : 'practice'} model={model} running={solved} solved={solved}
    interactive={!disabled && !solved} showExpression={showExpression} selectedGroups={selectedGroups}
    description={description} onSolutionShown={onSolutionShown} />;
}
