import { useReducedMotion } from 'react-native-reanimated';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';
import { IdleHint } from '../kit/PracticeAffordances';

/** Point toward the row as a whole, without drawing attention to an answer. */
export function FractionChoiceHint({ mechanic, width, interacted }: {
  mechanic: 'partition' | 'whole-choice' | 'groups-choice'; width: number; interacted: boolean;
}) {
  const firstEncounter = useFirstQuantityEncounter(`fraction-${mechanic}`, !interacted);
  const reduced = useReducedMotion();
  const demonstrate = firstEncounter && !reduced;
  if (width <= 0) return null;
  if (mechanic === 'partition') return <IdleHint movable firstEncounter={firstEncounter} interacted={interacted}
    from={{ x: width / 2, y: demonstrate ? -10 : 13 }} to={{ x: width / 2, y: 13 }} />;
  // Sweep above all the choices. A downward tap over the center could suggest that chip.
  return <IdleHint movable firstEncounter={firstEncounter} interacted={interacted}
    from={{ x: demonstrate ? 20 : width / 2, y: -22 }} to={{ x: width - 20, y: -22 }} />;
}
