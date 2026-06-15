import * as Haptics from 'expo-haptics';
import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinCounter } from '@/components/economy/CoinCounter';
import { PetStage } from '@/components/pet';
import { useGame } from '@/contexts/GameProvider';
import {
  FEED_COST,
  FEED_HUNGER_RESTORE,
  GameColors,
  ONE_SHOT_ANIMATIONS,
  PET_HAPPINESS_BOOST,
} from '@/constants/game';
import { pickRandomExcitedMood } from '@/constants/pet-videos';
import { usePetMood } from '@/hooks/use-pet-mood';
import type { PetAnimationState } from '@/types/game';
import { moderateScale } from '@/utils/scale';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function HomeScreen() {
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    setPet,
    setWallet,
  } = useGame();
  const [actionMood, setActionMood] = useState<PetAnimationState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const baseMood = usePetMood(pet.stats);
  const displayMood = actionMood ?? baseMood;

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  const playActionMood = useCallback((mood: PetAnimationState) => {
    triggerHaptic();
    setActionMood(mood);
  }, []);

  const handlePetTap = useCallback(() => {
    playActionMood(pickRandomExcitedMood());
    setPet((current) => ({
      ...current,
      stats: {
        ...current.stats,
        happiness: Math.min(100, current.stats.happiness + PET_HAPPINESS_BOOST),
      },
    }));
  }, [playActionMood, setPet]);

  const handleFeed = useCallback(() => {
    if (wallet.coins < FEED_COST) {
      triggerHaptic();
      showMessage(`Need ${FEED_COST} coins to feed ${pet.name}!`);
      return;
    }

    triggerHaptic();
    setWallet((current) => ({ coins: current.coins - FEED_COST }));
    setPet((current) => ({
      ...current,
      stats: {
        ...current.stats,
        hunger: Math.min(100, current.stats.hunger + FEED_HUNGER_RESTORE),
        happiness: Math.min(100, current.stats.happiness + 5),
      },
    }));
    setActionMood('eating');
    showMessage(`${pet.name} enjoyed the snack!`);
  }, [pet.name, setPet, setWallet, showMessage, wallet.coins]);

  const handlePlayPuzzle = useCallback(() => {
    triggerHaptic();
    playActionMood('dancing');
    showMessage('Puzzles are coming soon — keep practicing!');
  }, [playActionMood, showMessage]);

  const handleAnimationComplete = useCallback(() => {
    setActionMood((current) =>
      current && ONE_SHOT_ANIMATIONS.includes(current) ? null : current,
    );
  }, []);

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

  const canFeed = wallet.coins >= FEED_COST;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hi there!</Text>
            <Text style={styles.subtitle}>Take care of {pet.name}</Text>
          </View>
          <CoinCounter coins={wallet.coins} streak={progress.streak} />
        </View>

        <View style={styles.stageWrap}>
          <PetStage
            compact
            name={pet.name}
            stats={pet.stats}
            mood={displayMood}
            onPetPress={handlePetTap}
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
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={handlePetTap}
              accessibilityRole="button"
              accessibilityLabel="Pet your companion"
            >
              <Text style={styles.actionEmoji}>🐾</Text>
              <Text style={styles.actionLabel}>Pet</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSecondary,
                !canFeed && styles.actionDisabled,
              ]}
              onPress={handleFeed}
              accessibilityRole="button"
              accessibilityLabel={`Feed for ${FEED_COST} coins`}
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
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: GameColors.textMuted,
    marginTop: 2,
  },
  stageWrap: {
    flex: 1,
    minHeight: 0,
  },
  messageToast: {
    position: 'absolute',
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
    fontWeight: '600',
    color: GameColors.text,
    textAlign: 'center',
  },
  footer: {
    gap: moderateScale(10),
  },
  actions: {
    flexDirection: 'row',
    gap: moderateScale(10),
  },
  actionBtn: {
    flex: 1,
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
    color: GameColors.text,
  },
  actionHint: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: GameColors.textMuted,
  },
  primaryBtn: {
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    alignItems: 'center',
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
    fontWeight: '800',
    color: '#FFFFFF',
  },
  primaryBtnHint: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
