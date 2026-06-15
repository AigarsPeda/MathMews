import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGame } from '@/contexts/GameProvider';
import { GameColors } from '@/constants/game';
import { PET_NAME_MAX_LENGTH } from '@/types/save';
import { moderateScale } from '@/utils/scale';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function NamePetScreen() {
  const router = useRouter();
  const { isReady, hasCompletedOnboarding, completeOnboarding } = useGame();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedName = name.trim();
  const canContinue = trimmedName.length > 0 && !isSubmitting;

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;

    triggerHaptic();
    setIsSubmitting(true);

    const ok = await completeOnboarding(trimmedName);
    setIsSubmitting(false);

    if (ok) {
      router.replace('/');
    }
  }, [canContinue, completeOnboarding, router, trimmedName]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={GameColors.primary} />
      </View>
    );
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🐶</Text>
            <Text style={styles.title}>Name your puppy!</Text>
            <Text style={styles.subtitle}>
              Pick a name for your new friend. You can see it on the home screen.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Pet name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Buddy"
              placeholderTextColor={GameColors.textMuted}
              maxLength={PET_NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              autoFocus
              accessibilityLabel="Pet name"
            />
            <Text style={styles.hint}>
              {trimmedName.length}/{PET_NAME_MAX_LENGTH} characters
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryBtn,
              !canContinue && styles.primaryBtnDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue with pet name"
            accessibilityState={{ disabled: !canContinue }}
          >
            <Text style={styles.primaryBtnText}>
              {isSubmitting ? 'Saving…' : 'Meet my pet!'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(24),
    paddingBottom: moderateScale(16),
    justifyContent: 'space-between',
    gap: moderateScale(24),
  },
  header: {
    alignItems: 'center',
    gap: moderateScale(12),
  },
  emoji: {
    fontSize: moderateScale(64),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: GameColors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    color: GameColors.textMuted,
    textAlign: 'center',
    lineHeight: moderateScale(24),
    maxWidth: moderateScale(320),
  },
  form: {
    gap: moderateScale(8),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: GameColors.text,
  },
  input: {
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(16),
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: GameColors.text,
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: GameColors.textMuted,
  },
  primaryBtn: {
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(20),
    minHeight: moderateScale(56),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    shadowColor: GameColors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
