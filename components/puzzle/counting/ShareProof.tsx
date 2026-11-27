import { useState } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { PuzzleObject } from '@/types/puzzle-object';
import { QuantityEquation } from './QuantityEquation';
import { RevealSurface } from '../kit/RevealSurface';
import { useRevealBeats } from '../kit/useRevealBeats';
import { useQuantityPractice } from './QuantityPractice';
import { finishDeal, SharingTable, submittedSlots } from './SharingTable';
import { canSnapshotModel } from './useModelPaint';
import { useProofAnnouncement } from './useProofAnnouncement';

export function ShareProof({items, groups, selectedGroups = 0, initialLocations, object, attempt = false, onSolutionShown}: {
  items: number; groups: number; selectedGroups?: number; object?: PuzzleObject; initialLocations?: readonly number[]; attempt?: boolean; onSolutionShown?: () => void;
}) {
  const {t} = useTranslation();
  const practice = useQuantityPractice();
  const [start] = useState(() => {
    const submitted = initialLocations ?? practice.snapshot.locations;
    return submitted.length === items ? [...submitted] : Array<number>(items).fill(0);
  });
  const [flights] = useState(() => attempt ? [] : finishDeal(start, submittedSlots(start, practice.snapshot), groups));
  // Advance a round on the JS clock. Each plant flies separately on the UI thread.
  const batch = Math.max(1, Math.ceil(flights.length / 6));
  const rounds = Math.ceil(flights.length / batch);
  const beats = useRevealBeats(rounds + 1, {awaitInitialPaint: canSnapshotModel, lead: 45,
    step: attempt ? 360 : i => i > rounds ? 180 : Math.min(390, batch * 135), hold: 0, minTotal: 0, reducedSteps: true, onDone: onSolutionShown});
  const position = useDerivedValue(() => Math.min(flights.length, beats.position.value * batch));
  const each = Math.floor(items / groups), remainder = items % groups;
  // Inspect one part of the submitted deal. An evenly dealt fraction can still have a wrong scalar answer.
  let attemptTray: number | undefined;
  if (attempt) {
    const counts = Array<number>(groups + 1).fill(0);
    for (const place of start) counts[place]++;
    const unequalTray = counts.findIndex((count, index) => index > 0 && count !== each);
    attemptTray = counts[0] > remainder ? 0 : unequalTray > 0 ? unequalTray : 1;
  }
  const equation = selectedGroups ? `${t('friendlyQ.fractionOf', {fraction: `${selectedGroups}/${groups}`, whole: items, defaultValue: '{{fraction}} of {{whole}}'})} = ${selectedGroups * each}` :
    remainder ? `${items} = ${groups} × ${each} + ${remainder}` : `${items} ÷ ${groups} = ${each}`;
  useProofAnnouncement(beats, !attempt && beats.settled ? equation : '', true);
  return <RevealSurface beats={beats} replayable={!attempt || !selectedGroups}>
    <SharingTable {...{items, groups, object, selectedGroups, beats, flights, position, attemptTray}} completed={Math.min(flights.length, beats.landed * batch)} initialLocations={start} disabled tintAt={attempt ? undefined : rounds} highlight={!attempt && beats.settled} />
    {!attempt && <QuantityEquation text={equation} settled={beats.settled} />}
  </RevealSurface>;
}
