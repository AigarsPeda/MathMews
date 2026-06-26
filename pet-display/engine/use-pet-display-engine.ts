import { PET_CARE_COOLDOWN_MS } from "@/constants/game";
import { usePetBaseMood } from "@/pet-display/engine/derive-mood";
import { getPetMediaRegistry } from "@/pet-display/registry/dog-video-registry";
import type {
  PetDisplayCommand,
  PetDisplayEngine,
  PetMediaScenario,
  PetPlaybackState,
} from "@/pet-display/types";
import type { PetAnimationState, PetProfile } from "@/types/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type ActiveScenario = {
  scenario: PetMediaScenario;
  thenMood: PetAnimationState | null;
};

export function usePetDisplayEngine(pet: PetProfile): PetDisplayEngine {
  const { t } = useTranslation();
  const registry = getPetMediaRegistry(pet.type);
  const { mood: baseMood, onFallAsleepComplete } = usePetBaseMood(pet);
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
        kind: "scenario",
        scenario: activeScenario.scenario,
        steps: activeScenario.scenario.steps,
      };
    }

    const mood = actionMood ?? baseMood;
    return {
      kind: "segment",
      segment: registry.getSegment(mood),
      mood,
    };
  }, [actionMood, activeScenario, baseMood, registry]);

  const displayLabel = useMemo(() => {
    if (playback.kind === "scenario") {
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
    return actionMood !== null && registry.oneShotStates.includes(actionMood);
  }, [actionMood, activeScenario, registry.oneShotStates]);

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
          scenario: registry.getScenario("wakeUp"),
          thenMood: mood,
        });
        return;
      }
      setActionMood(mood);
    },
    [registry],
  );

  const handleAnimationComplete = useCallback(
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
        if (current && registry.oneShotStates.includes(current)) {
          if (careActionBusyRef.current) {
            finishCareAction();
          }
          return null;
        }
        return current;
      });

      if (completedMood === "fallingAsleep") {
        onFallAsleepComplete();
      }
    },
    [
      activeScenario,
      finishCareAction,
      onFallAsleepComplete,
      registry.oneShotStates,
    ],
  );

  const send = useCallback(
    (command: PetDisplayCommand) => {
      switch (command.type) {
        case "beginCareAction":
          beginCareAction();
          break;
        case "petTap":
          playAction(command.wasAsleep, registry.pickExcitedMood());
          break;
        case "playAction":
          playAction(command.wasAsleep, command.mood);
          break;
        case "feed":
          beginCareAction();
          playAction(command.wasAsleep, "eating");
          break;
        case "playReaction":
          setActiveScenario(null);
          setActionMood(command.mood);
          break;
        case "animationComplete":
          handleAnimationComplete(command.completedMood);
          break;
      }
    },
    [beginCareAction, handleAnimationComplete, playAction, registry],
  );

  return {
    playback,
    baseMood,
    displayLabel,
    isCareBlocked,
    isCareAnimationPlaying,
    send,
  };
}
