import { ONE_SHOT_ANIMATIONS, PET_CARE_COOLDOWN_MS } from '@/constants/game';
import { getPetScenario } from '@/constants/pet-scenarios';
import { moodToSegment } from '@/constants/pet-scenarios';
import { usePetVideoMood } from '@/hooks/use-pet-mood';
import type { PetAnimationState, PetProfile } from '@/types/game';
import type { PetAnimationScenario, PetVideoSegment } from '@/types/pet-animation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ActiveScenario = {
  scenario: PetAnimationScenario;
  thenMood: PetAnimationState | null;
};

export type PetPlaybackState =
  | { kind: 'scenario'; scenario: PetAnimationScenario; steps: PetVideoSegment[] }
  | { kind: 'segment'; segment: PetVideoSegment; mood: PetAnimationState };

export function usePetPlayback(pet: PetProfile) {
  const { t } = useTranslation();
  const { mood: baseVideoMood, onFallAsleepComplete } = usePetVideoMood(pet);
  const [actionMood, setActionMood] = useState<PetAnimationState | null>(null);
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(
    null,
  );
  const [careActionBusy, setCareActionBusy] = useState(false);
  const [careCooldownUntil, setCareCooldownUntil] = useState(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  const careActionBusyRef = useRef(false);

  const playback = useMemo((): PetPlaybackState => {
    if (activeScenario) {
      return {
        kind: 'scenario',
        scenario: activeScenario.scenario,
        steps: activeScenario.scenario.steps,
      };
    }

    const mood = actionMood ?? baseVideoMood;
    return { kind: 'segment', segment: moodToSegment(mood), mood };
  }, [actionMood, activeScenario, baseVideoMood]);

  const displayLabel = useMemo(() => {
    if (playback.kind === 'scenario') {
      return t(`scenario.${playback.scenario.id}`);
    }
    return t(`mood.${playback.mood}`);
  }, [playback, t]);

  useEffect(() => {
    const remaining = careCooldownUntil - Date.now();
    if (remaining <= 0) return;
    const id = setTimeout(() => setCooldownTick((n) => n + 1), remaining + 50);
    return () => clearTimeout(id);
  }, [careCooldownUntil, cooldownTick]);

  const isCareBlocked = careActionBusy || Date.now() < careCooldownUntil;

  const isCareAnimationPlaying = useMemo(() => {
    if (activeScenario) return true;
    return actionMood !== null && ONE_SHOT_ANIMATIONS.includes(actionMood);
  }, [activeScenario, actionMood]);

  // Recover if a care animation ends without clearing the busy flag.
  useEffect(() => {
    if (isCareAnimationPlaying || !careActionBusy) return;
    careActionBusyRef.current = false;
    setCareActionBusy(false);
  }, [isCareAnimationPlaying, careActionBusy]);

  const beginCareAction = useCallback(() => {
    careActionBusyRef.current = true;
    setCareActionBusy(true);
  }, []);

  const finishCareAction = useCallback(() => {
    careActionBusyRef.current = false;
    setCareActionBusy(false);
    setCareCooldownUntil(Date.now() + PET_CARE_COOLDOWN_MS);
  }, []);

  const playAction = useCallback(
    (wasAsleep: boolean, mood: PetAnimationState) => {
      if (wasAsleep) {
        setActiveScenario({
          scenario: getPetScenario('wakeUp'),
          thenMood: mood,
        });
        return;
      }
      setActionMood(mood);
    },
    [],
  );

  const handleSegmentComplete = useCallback(
    (completedMood: PetAnimationState) => {
      if (activeScenario) {
        const thenMood = activeScenario.thenMood;
        setActiveScenario(null);
        if (thenMood) {
          setActionMood(thenMood);
        }
        return;
      }

      setActionMood((current) => {
        if (current && ONE_SHOT_ANIMATIONS.includes(current)) {
          if (careActionBusyRef.current) {
            finishCareAction();
          }
          return null;
        }
        return current;
      });

      if (completedMood === 'fallingAsleep') {
        onFallAsleepComplete();
      }
    },
    [activeScenario, finishCareAction, onFallAsleepComplete],
  );

  return {
    playback,
    displayLabel,
    baseVideoMood,
    playAction,
    setActionMood,
    handleSegmentComplete,
    isCareBlocked,
    isCareAnimationPlaying,
    beginCareAction,
  };
}
