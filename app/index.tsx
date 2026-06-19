import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { PetStage } from "@/components/pet/PetStage";
import {
  FEED_COST,
  FEED_HAPPINESS_BOOST,
  FEED_HUNGER_RESTORE,
  GameColors,
  PET_HAPPINESS_BOOST,
} from "@/constants/game";
import { pickRandomExcitedMood } from "@/constants/pet-videos";
import { useGame } from "@/contexts/GameProvider";
import { usePetPlayback } from "@/hooks/use-pet-playback";
import { shouldPetSleep } from "@/hooks/use-pet-mood";
import type { PetStats } from "@/types/game";
import {
  canFeedForEffect,
  clampStat,
  isHappinessMax,
  isHungerMax,
  withPetCareUpdate,
} from "@/utils/pet-care";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    setPet,
    setWallet,
    recordInteraction,
  } = useGame();
  const [message, setMessage] = useState<string | null>(null);

  const {
    playback,
    displayLabel,
    baseVideoMood,
    playAction,
    handleSegmentComplete,
    isCareBlocked,
    isCareAnimationPlaying,
    beginCareAction,
  } = usePetPlayback(pet);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  const rejectCareAction = useCallback(
    (text: string) => {
      triggerHaptic();
      showMessage(text);
    },
    [showMessage],
  );

  const playActionMood = useCallback(
    (wasAsleep: boolean, mood: Parameters<typeof playAction>[1]) => {
      triggerHaptic();
      playAction(wasAsleep, mood);
    },
    [playAction],
  );

  const wakePet = useCallback(
    (updateStats: (stats: PetStats) => PetStats) => {
      const now = Date.now();
      setPet((current) => ({
        ...withPetCareUpdate(current, updateStats),
        isAsleep: false,
        lastInteractionAt: now,
      }));
    },
    [setPet],
  );

  const handlePetTap = useCallback(() => {
    if (isCareAnimationPlaying) return;

    const wasAsleep = pet.isAsleep === true;

    recordInteraction();
    playActionMood(wasAsleep, pickRandomExcitedMood());
    wakePet((stats) => ({
      ...stats,
      happiness: isHappinessMax(stats)
        ? stats.happiness
        : clampStat(stats.happiness + PET_HAPPINESS_BOOST),
    }));
  }, [isCareAnimationPlaying, pet.isAsleep, playActionMood, recordInteraction, wakePet]);

  const handleFeed = useCallback(() => {
    const wasAsleep = pet.isAsleep === true;

    if (isCareAnimationPlaying || isCareBlocked) {
      rejectCareAction(`Give ${pet.name} a moment!`);
      return;
    }

    if (!canFeedForEffect(pet.stats, wasAsleep)) {
      rejectCareAction(`${pet.name} isn't hungry right now.`);
      return;
    }

    if (wallet.coins < FEED_COST) {
      rejectCareAction(`Need ${FEED_COST} coins to feed ${pet.name}!`);
      return;
    }

    recordInteraction();
    beginCareAction();
    triggerHaptic();
    setWallet((current) => ({ coins: current.coins - FEED_COST }));
    wakePet((stats) => ({
      ...stats,
      hunger: isHungerMax(stats)
        ? stats.hunger
        : clampStat(stats.hunger + FEED_HUNGER_RESTORE),
      happiness: isHappinessMax(stats)
        ? stats.happiness
        : clampStat(stats.happiness + FEED_HAPPINESS_BOOST),
    }));
    playActionMood(wasAsleep, "eating");
    showMessage(`${pet.name} enjoyed the snack!`);
  }, [
    beginCareAction,
    isCareAnimationPlaying,
    isCareBlocked,
    pet.isAsleep,
    pet.name,
    pet.stats,
    playActionMood,
    recordInteraction,
    rejectCareAction,
    setWallet,
    showMessage,
    wakePet,
    wallet.coins,
  ]);

  const handlePlayPuzzle = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    router.push("/puzzles");
  }, [recordInteraction, router]);

  const handleAnimationComplete = useCallback(() => {
    const completedMood =
      playback.kind === "segment" ? playback.mood : baseVideoMood;
    handleSegmentComplete(completedMood);
    if (completedMood === "fallingAsleep") {
      setPet((current) =>
        shouldPetSleep(current) ? { ...current, isAsleep: true } : current,
      );
    }
  }, [baseVideoMood, handleSegmentComplete, playback, setPet]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={GameColors.primary} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding/name-pet" />;
  }

  const wasAsleep = pet.isAsleep === true;
  const canFeedEffect =
    canFeedForEffect(pet.stats, wasAsleep) && wallet.coins >= FEED_COST;
  const feedDimmed =
    !canFeedEffect || isCareBlocked || isCareAnimationPlaying;
  const petAnimating = isCareAnimationPlaying;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hi there!</Text>
            <Text style={styles.subtitle}>Take care of {pet.name}</Text>
          </View>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <View style={styles.stageWrap}>
          <PetStage
            compact
            name={pet.name}
            stats={pet.stats}
            moodLabel={displayLabel}
            playback={playback}
            onPetPress={petAnimating ? undefined : handlePetTap}
            onAnimationComplete={handleAnimationComplete}
          />
          {message && (
            <View style={styles.messageToast}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSecondary,
                petAnimating && styles.actionDisabled,
              ]}
              onPress={handlePetTap}
              disabled={petAnimating}
              accessibilityRole="button"
              accessibilityLabel="Pet your companion"
              accessibilityState={{ disabled: petAnimating }}
            >
              <Text style={styles.actionEmoji}>🐾</Text>
              <Text style={styles.actionLabel}>Pet</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSecondary,
                feedDimmed && styles.actionDisabled,
              ]}
              onPress={handleFeed}
              disabled={!canFeedEffect || isCareAnimationPlaying || isCareBlocked}
              accessibilityRole="button"
              accessibilityLabel={`Feed for ${FEED_COST} coins`}
              accessibilityState={{
                disabled:
                  !canFeedEffect || isCareAnimationPlaying || isCareBlocked,
              }}
            >
              <Text style={styles.actionEmoji}>🍖</Text>
              <Text style={styles.actionLabel}>Feed</Text>
              <Text style={styles.actionHint}>{FEED_COST} 🪙</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={handlePlayPuzzle}
            accessibilityRole="button"
            accessibilityLabel="Solve a math puzzle"
          >
            <Text style={styles.primaryBtnText}>🥜 Solve a Puzzle</Text>
            <Text style={styles.primaryBtnHint}>Earn coins for {pet.name}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
    gap: moderateScale(10),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: moderateScale(8),
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    marginTop: 2,
  },
  stageWrap: {
    flex: 1,
    minHeight: 0,
  },
  messageToast: {
    position: "absolute",
    bottom: moderateScale(12),
    left: moderateScale(12),
    right: moderateScale(12),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.secondary,
    zIndex: 10,
  },
  messageText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.text,
    textAlign: "center",
  },
  footer: {
    gap: moderateScale(10),
  },
  actions: {
    flexDirection: "row",
    gap: moderateScale(10),
  },
  actionBtn: {
    flex: 1,
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(8),
    gap: 2,
  },
  actionSecondary: {
    backgroundColor: GameColors.card,
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  actionEmoji: {
    fontSize: moderateScale(24),
  },
  actionLabel: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
  actionHint: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: GameColors.textMuted,
  },
  primaryBtn: {
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: 2,
    minHeight: moderateScale(56),
    shadowColor: GameColors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  primaryBtnHint: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
});
