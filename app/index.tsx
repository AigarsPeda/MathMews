import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { HeaderChip } from "@/components/home/HeaderChip";
import { PetStage } from "@/components/pet/PetStage";
import { PuzzleStreakSlot } from "@/components/pet/PuzzleStreakSlot";
import type { CatBedId } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import {
  BOX_PLAY_COST,
  BOX_PLAY_HAPPINESS_BOOST,
  FEED_COST,
  FEED_HAPPINESS_BOOST,
  FEED_HUNGER_RESTORE,
  GameColors,
  HEADER_CHIP_SIZE,
  PET_HAPPINESS_BOOST,
  PUZZLE_STREAK_NOTIFY_MIN,
} from "@/constants/game";
import { USE_CAT_SPRITE_PETS } from "@/constants/pet-display";
import { computePetWisdom } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { shouldPetSleep } from "@/pet-display/engine/derive-mood";
import { usePetDisplay } from "@/pet-display/hooks/use-pet-display";
import type { PetStats, RoomLayerItem } from "@/types/game";
import {
  boostStat,
  canFeedForEffect,
  canPlayBoxForEffect,
  withPetCareUpdate,
} from "@/utils/pet-care";
import {
  getContextualSpeechMessage,
  pickPetTapSpeechKey,
} from "@/utils/pet-speech";
import {
  updatePlacedDecorationOffsetByInstance,
  updatePlacedToyOffsetByInstance,
  findPlacedDecorationByInstance,
  findPlacedToyByInstance,
} from "@/utils/room-placement";
import { useScreenInsets } from "@/hooks/use-screen-insets";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STORE_ICON = require("@/assets/images/store-icon.png");

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const screenInsets = useScreenInsets();
  const { locale } = useLocale();
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    setPet,
    setWallet,
    recordInteraction,
    removeDecorationFromRoom,
    removeBedFromRoom,
    removeToyFromRoom,
    moveRoomLayerItem,
    rotatePlacedDecoration,
    flipPlacedDecorationWall,
    scalePlacedDecoration,
  } = useGame();
  const [actionSpeech, setActionSpeech] = useState<string | null>(null);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    playback,
    baseMood: baseVideoMood,
    send: sendPetCommand,
    isCareBlocked,
    isCareAnimationPlaying,
  } = usePetDisplay(pet);

  const showSpeech = useCallback((text: string, durationMs = 2800) => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
    }
    setActionSpeech(text);
    speechTimerRef.current = setTimeout(() => {
      setActionSpeech(null);
      speechTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
      }
    };
  }, []);

  const contextualSpeech = useMemo(
    () =>
      getContextualSpeechMessage(
        {
          pet,
          mood: baseVideoMood,
          locale,
          puzzlesSolved: progress.puzzlesSolved,
          puzzleStreak: progress.puzzleStreak,
        },
        t,
      ),
    [
      baseVideoMood,
      locale,
      pet,
      progress.puzzleStreak,
      progress.puzzlesSolved,
      t,
    ],
  );

  const showPuzzleStreak =
    progress.puzzleStreak >= PUZZLE_STREAK_NOTIFY_MIN && actionSpeech === null;

  const speechMessage = actionSpeech ?? contextualSpeech;

  const rejectCareAction = useCallback(
    (text: string) => {
      triggerHaptic();
      showSpeech(text);
    },
    [showSpeech],
  );

  const playActionMood = useCallback(
    (wasAsleep: boolean, mood: "excited" | "eating" | "playBox") => {
      triggerHaptic();
      sendPetCommand({ type: "playAction", wasAsleep, mood });
    },
    [sendPetCommand],
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
    playActionMood(wasAsleep, "excited");
    showSpeech(t(pickPetTapSpeechKey(), { name: pet.name }));
    wakePet((stats) => ({
      ...stats,
      happiness: boostStat(stats.happiness, PET_HAPPINESS_BOOST),
    }));
  }, [
    isCareAnimationPlaying,
    pet.isAsleep,
    playActionMood,
    recordInteraction,
    showSpeech,
    t,
    wakePet,
  ]);

  const handleFeed = useCallback(() => {
    const wasAsleep = pet.isAsleep === true;

    if (isCareAnimationPlaying || isCareBlocked) {
      rejectCareAction(t("home.giveMoment", { name: pet.name }));
      return;
    }

    if (!canFeedForEffect(pet.stats, wasAsleep)) {
      rejectCareAction(t("home.notHungry", { name: pet.name }));
      return;
    }

    if (wallet.coins < FEED_COST) {
      rejectCareAction(
        t("home.needCoinsFeed", { cost: FEED_COST, name: pet.name }),
      );
      return;
    }

    recordInteraction();
    sendPetCommand({ type: "beginCareAction" });
    setWallet((current) => ({ coins: current.coins - FEED_COST }));
    wakePet((stats) => ({
      ...stats,
      hunger: boostStat(stats.hunger, FEED_HUNGER_RESTORE),
      happiness: boostStat(stats.happiness, FEED_HAPPINESS_BOOST),
    }));
    playActionMood(wasAsleep, "eating");
    showSpeech(t("home.enjoyedSnack", { name: pet.name }));
  }, [
    isCareAnimationPlaying,
    isCareBlocked,
    pet.isAsleep,
    pet.name,
    pet.stats,
    playActionMood,
    recordInteraction,
    rejectCareAction,
    sendPetCommand,
    setWallet,
    showSpeech,
    t,
    wakePet,
    wallet.coins,
  ]);

  const handlePlayBox = useCallback(() => {
    const wasAsleep = pet.isAsleep === true;

    if (isCareAnimationPlaying || isCareBlocked) {
      rejectCareAction(t("home.giveMoment", { name: pet.name }));
      return;
    }

    if (!canPlayBoxForEffect(pet.stats, wasAsleep)) {
      rejectCareAction(t("home.alreadyHappy", { name: pet.name }));
      return;
    }

    if (wallet.coins < BOX_PLAY_COST) {
      rejectCareAction(
        t("home.needCoinsPlayBox", { cost: BOX_PLAY_COST, name: pet.name }),
      );
      return;
    }

    recordInteraction();
    sendPetCommand({ type: "beginCareAction" });
    setWallet((current) => ({ coins: current.coins - BOX_PLAY_COST }));
    wakePet((stats) => ({
      ...stats,
      happiness: boostStat(stats.happiness, BOX_PLAY_HAPPINESS_BOOST),
    }));
    playActionMood(wasAsleep, "playBox");
    showSpeech(t("home.enjoyedPlayBox", { name: pet.name }));
  }, [
    isCareAnimationPlaying,
    isCareBlocked,
    pet.isAsleep,
    pet.name,
    pet.stats,
    playActionMood,
    recordInteraction,
    rejectCareAction,
    sendPetCommand,
    setWallet,
    showSpeech,
    t,
    wakePet,
    wallet.coins,
  ]);

  const handleOpenSettings = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    router.push("/settings");
  }, [recordInteraction, router]);

  const handleOpenStore = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    router.push("/store");
  }, [recordInteraction, router]);

  const handleMoveRoomLayerItem = useCallback(
    (item: RoomLayerItem, direction: "up" | "down") => {
      const moved = moveRoomLayerItem(item, direction);
      if (!moved) return;

      recordInteraction();
      triggerHaptic();
    },
    [moveRoomLayerItem, recordInteraction],
  );

  const handleRotatePlacedDecoration = useCallback(
    (instanceId: string) => {
      const rotated = rotatePlacedDecoration(instanceId);
      if (!rotated) return;

      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, rotatePlacedDecoration],
  );

  const handleFlipPlacedDecorationWall = useCallback(
    (instanceId: string) => {
      const flipped = flipPlacedDecorationWall(instanceId);
      if (!flipped) return;

      recordInteraction();
      triggerHaptic();
    },
    [flipPlacedDecorationWall, recordInteraction],
  );

  const handleScalePlacedDecoration = useCallback(
    (instanceId: string, direction: "up" | "down") => {
      const scaled = scalePlacedDecoration(instanceId, direction);
      if (!scaled) return;

      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, scalePlacedDecoration],
  );

  const handleRemoveDecoration = useCallback(
    (instanceId: string) => {
      const placed = findPlacedDecorationByInstance(
        pet.placedDecorations,
        instanceId,
      );
      if (!placed) return;

      const removed = removeDecorationFromRoom(
        placed.decorationId as CatDecorationId,
        instanceId,
      );
      if (!removed) return;

      recordInteraction();
      triggerHaptic();
      const name = t(`store.decorationName.${placed.decorationId}`).replace(
        /\n/g,
        " ",
      );
      showSpeech(t("home.removedFromRoom", { name }));
    },
    [
      pet.placedDecorations,
      recordInteraction,
      removeDecorationFromRoom,
      showSpeech,
      t,
    ],
  );

  const handleRemoveBed = useCallback(() => {
    const bedId = pet.bedId as CatBedId | undefined;
    if (!bedId) return;

    const removed = removeBedFromRoom();
    if (!removed) return;

    recordInteraction();
    triggerHaptic();
    const name = t(`store.bedName.${bedId}`);
    showSpeech(t("home.removedFromRoom", { name }));
  }, [pet.bedId, recordInteraction, removeBedFromRoom, showSpeech, t]);

  const handleRemoveToy = useCallback(
    (instanceId: string) => {
      const placed = findPlacedToyByInstance(pet.placedToys, instanceId);
      if (!placed) return;

      const removed = removeToyFromRoom(placed.toyId as CatToyId, instanceId);
      if (!removed) return;

      recordInteraction();
      triggerHaptic();
      const name = t(`store.toyName.${placed.toyId}`).replace(/\n/g, " ");
      showSpeech(t("home.removedFromRoom", { name }));
    },
    [pet.placedToys, recordInteraction, removeToyFromRoom, showSpeech, t],
  );

  const handlePlayPuzzle = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    router.push("/puzzles");
  }, [recordInteraction, router]);

  const handleAnimationComplete = useCallback(() => {
    const completedMood =
      playback.kind === "segment"
        ? playback.mood
        : playback.kind === "scenario" && playback.scenario.id === "playBox"
          ? "playBox"
          : baseVideoMood;
    sendPetCommand({ type: "animationComplete", completedMood });
    if (completedMood === "fallingAsleep") {
      setPet((current) =>
        shouldPetSleep(current) ? { ...current, isAsleep: true } : current,
      );
    }
  }, [baseVideoMood, playback, sendPetCommand, setPet]);

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
  const canFeedForHunger = canFeedForEffect(pet.stats, wasAsleep);
  const canPlayBoxForHappiness = canPlayBoxForEffect(pet.stats, wasAsleep);
  const canAffordFeed = wallet.coins >= FEED_COST;
  const canAffordPlayBox = wallet.coins >= BOX_PLAY_COST;
  const feedDimmed =
    !canFeedForHunger ||
    !canAffordFeed ||
    isCareBlocked ||
    isCareAnimationPlaying;
  const playBoxDimmed =
    !canPlayBoxForHappiness ||
    !canAffordPlayBox ||
    isCareBlocked ||
    isCareAnimationPlaying;
  const isCatSpritePet = USE_CAT_SPRITE_PETS && pet.type === "cat";
  const petAnimating = isCareAnimationPlaying;

  return (
    <View style={[styles.safe, screenInsets]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          {isCatSpritePet ? (
            <HeaderChip
              onPress={handleOpenStore}
              accessibilityLabel={t("home.a11yStore")}
            >
              <Image
                source={STORE_ICON}
                style={styles.headerStoreIcon}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </HeaderChip>
          ) : (
            <View style={styles.headerSideSlot} />
          )}
          <View style={styles.headerSpacer} />
          <View style={styles.headerRight}>
            <GameHeaderStats
              coins={wallet.coins}
              streak={progress.streak}
              lives={progress.lives}
            />
            <HeaderChip
              onPress={handleOpenSettings}
              accessibilityLabel={t("home.a11ySettings")}
            >
              <Text style={styles.headerIconEmoji}>⚙️</Text>
            </HeaderChip>
          </View>
        </View>

        <View style={styles.middle}>
          <View style={styles.stageWrap}>
            <PetStage
              compact
              name={pet.name}
              petType={pet.type}
              catSkinId={pet.catSkinId}
              stats={pet.stats}
              wisdom={computePetWisdom(progress.puzzlesSolved)}
              roomId={pet.roomId}
              roomPetOffset={pet.roomPetOffset}
              bedId={pet.bedId}
              roomBedOffset={pet.roomBedOffset}
              placedToys={pet.placedToys}
              placedDecorations={pet.placedDecorations}
              roomLayerOrder={pet.roomLayerOrder}
              speechMessage={speechMessage}
              playback={playback}
              onPetPress={petAnimating ? undefined : handlePetTap}
              onRoomPetOffsetChange={(offset) =>
                setPet((current) => ({ ...current, roomPetOffset: offset }))
              }
              onRoomBedOffsetChange={(offset) =>
                setPet((current) => ({ ...current, roomBedOffset: offset }))
              }
              onPlacedToyOffsetChange={(instanceId, offset) =>
                setPet((current) => ({
                  ...current,
                  placedToys: updatePlacedToyOffsetByInstance(
                    current.placedToys,
                    instanceId,
                    offset,
                  ),
                }))
              }
              onPlacedDecorationOffsetChange={(instanceId, offset) =>
                setPet((current) => ({
                  ...current,
                  placedDecorations: updatePlacedDecorationOffsetByInstance(
                    current.placedDecorations,
                    instanceId,
                    offset,
                  ),
                }))
              }
              onPlacedDecorationRemove={handleRemoveDecoration}
              onRotatePlacedDecoration={handleRotatePlacedDecoration}
              onFlipPlacedDecorationWall={handleFlipPlacedDecorationWall}
              onScalePlacedDecoration={handleScalePlacedDecoration}
              onMoveRoomLayerItem={handleMoveRoomLayerItem}
              onBedRemove={handleRemoveBed}
              onPlacedToyRemove={handleRemoveToy}
              onAnimationComplete={handleAnimationComplete}
            />
          </View>

          <PuzzleStreakSlot
            visible={showPuzzleStreak}
            count={progress.puzzleStreak}
          />
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
              accessibilityLabel={t("home.a11yPet")}
              accessibilityState={{ disabled: petAnimating }}
            >
              <Text style={styles.actionEmoji}>🐾</Text>
              <Text style={styles.actionLabel}>{t("home.pet")}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSecondary,
                feedDimmed && styles.actionDisabled,
              ]}
              onPress={handleFeed}
              disabled={isCareAnimationPlaying}
              accessibilityRole="button"
              accessibilityLabel={t("home.a11yFeed", { cost: FEED_COST })}
              accessibilityState={{ disabled: isCareAnimationPlaying }}
            >
              <Text style={styles.actionEmoji}>🍖</Text>
              <Text style={styles.actionLabel}>{t("home.feed")}</Text>
              <Text style={styles.actionHint}>
                {t("home.feedCost", { cost: FEED_COST })}
              </Text>
            </Pressable>

            {isCatSpritePet ? (
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionSecondary,
                  playBoxDimmed && styles.actionDisabled,
                ]}
                onPress={handlePlayBox}
                disabled={isCareAnimationPlaying}
                accessibilityRole="button"
                accessibilityLabel={t("home.a11yPlayBox", {
                  cost: BOX_PLAY_COST,
                })}
                accessibilityState={{ disabled: isCareAnimationPlaying }}
              >
                <Text style={styles.actionEmoji}>📦</Text>
                <Text style={styles.actionLabel}>{t("home.playBox")}</Text>
                <Text style={styles.actionHint}>
                  {t("home.playBoxCost", { cost: BOX_PLAY_COST })}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={handlePlayPuzzle}
            accessibilityRole="button"
            accessibilityLabel={t("home.a11ySolve")}
          >
            <Text style={styles.primaryBtnText}>{t("home.solvePuzzle")}</Text>
            <Text style={styles.primaryBtnHint}>
              {t("home.solvePuzzleHint", { name: pet.name })}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  },
  middle: {
    flex: 1,
    minHeight: 0,
    gap: moderateScale(10),
    marginBottom: moderateScale(10),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    marginBottom: moderateScale(10),
  },
  headerSideSlot: {
    width: moderateScale(HEADER_CHIP_SIZE),
  },
  headerSpacer: {
    flex: 1,
    minWidth: moderateScale(12),
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    flexShrink: 0,
  },
  headerIconEmoji: {
    fontSize: moderateScale(18),
  },
  headerStoreIcon: {
    width: moderateScale(HEADER_CHIP_SIZE),
    height: moderateScale(HEADER_CHIP_SIZE),
  },
  stageWrap: {
    flex: 1,
    minHeight: 0,
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
