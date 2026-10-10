import { shouldMountNativeRoom } from "@/utils/native-scene-cache";
import { getCatHomeRoomId, previewHomeRoom } from "@/utils/home-rooms";
import { HOME_ROOM_IDS, roomTravelDirection, type HomeRoomId, type RoomEntry } from "@/constants/home-rooms";
import { useRoomTransition } from "@/hooks/use-room-transition";
import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { HeaderChip } from "@/components/home/HeaderChip";
import { PetStage } from "@/components/pet/PetStage";
import { AppIcon } from "@/components/ui/AppIcon";
import { IconText as Text } from "@/components/ui/IconText";
import type { CatBedId } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatPlayActivity } from "@/constants/cat-play";
import type { CatToyId } from "@/constants/cat-toys";
import {
  GameColors,
  PET_HAPPINESS_BOOST,
} from "@/constants/game";
import { computePetWisdom } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { usePetSpeech } from "@/hooks/use-pet-speech";
import { useRoomEditor } from "@/hooks/use-room-editor";
import { useScreenInsets } from "@/hooks/use-screen-insets";
import { shouldPetSleep } from "@/pet-display/engine/derive-mood";
import { usePetDisplay } from "@/pet-display/hooks/use-pet-display";
import type { PetAnimationState, PetProfile, PetStats, RoomLayerItem } from "@/types/game";
import {
  boostStat,
  withPetCareUpdate,
} from "@/utils/pet-care";
import {
  getContextualSpeechMessage,
  pickPetTapSpeechKey,
} from "@/utils/pet-speech";
import {
  findPlacedDecorationByInstance,
  findPlacedToyByInstance,
  updatePlacedDecorationOffsetByInstance,
  updatePlacedToyOffsetByInstance,
} from "@/utils/room-placement";
import { moderateScale } from "@/utils/scale";
import { WorldClockControl } from '@/components/pet/WorldClockControl';
import { getStoreGoalDetails } from "@/utils/store-goal";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const roomActivityRef = useRef<{
    active: boolean;
    returnHome: () => void;
  } | null>(null);
  const handleRoomActivityChange = useCallback((active: boolean, returnHome: () => void) => {
    roomActivityRef.current = { active, returnHome };
  }, []);
  const { t } = useTranslation();
  const screenInsets = useScreenInsets();
  const { locale } = useLocale();
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    worldClock,
    wallet,
    progress,
    setPet,
    feedPet,
    recordInteraction,
    removeDecorationFromRoom,
    removeBedFromRoom,
    flipEquippedBed,
    scaleEquippedBed,
    removeToyFromRoom,
    scalePlacedToy,
    rotatePlacedToy,
    setRoomItemRotation,
    moveRoomLayerItem,
    rotatePlacedDecoration,
    flipPlacedDecorationWall,
    togglePlacedDecorationPower,
    togglePlacedCurtain,
    aimPlacedSpotlight,
    scalePlacedDecoration,
    visitHomeRoom,
    sendCatToRoom,
  } = useGame();
  const roomEditor = useRoomEditor(pet, setPet);
  const preloadedRooms = useMemo(() => HOME_ROOM_IDS.map(id => previewHomeRoom(pet, id)), [pet]);
  const { transition, progress: roomSlideProgress, visit: slideToRoom, ready: roomSceneReady } = useRoomTransition(pet, visitHomeRoom);
  const handleVisitRoom = useCallback((destination: HomeRoomId) => {
    const origin = pet.homeRoomId ?? 'livingRoom';
    if (origin === destination || transition) return;
    slideToRoom(destination);
  }, [pet, slideToRoom, transition]);
  const [catEntry, setCatEntry] = useState<{ roomId: HomeRoomId; entry: RoomEntry } | null>(null);
  const entrySequence = useRef(0);
  const handleCatRoomArrival = useCallback((destination: HomeRoomId) => {
    setCatEntry({ roomId: destination, entry: { id: ++entrySequence.current, direction: roomTravelDirection(getCatHomeRoomId(pet), destination) } });
    handleVisitRoom(destination);
    sendCatToRoom(destination);
  }, [handleVisitRoom, pet, sendCatToRoom]);
  const careActionPendingRef = useRef(false);

  const {
    playback,
    baseMood: baseVideoMood,
    send: sendPetCommand,
    isCareBlocked,
    isCareAnimationPlaying,
  } = usePetDisplay(pet, worldClock);

  useEffect(() => {
    if (!isCareBlocked && !isCareAnimationPlaying)
      careActionPendingRef.current = false;
  }, [isCareBlocked, isCareAnimationPlaying]);

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

  const { speechMessage, showSpeech } = usePetSpeech(contextualSpeech);

  const rejectCareAction = useCallback(
    (text: string) => {
      triggerHaptic();
      showSpeech(text);
    },
    [showSpeech],
  );

  const playActionMood = useCallback(
    (wasAsleep: boolean, mood: PetAnimationState) => {
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
    if (roomActivityRef.current?.active) {
      roomActivityRef.current.returnHome();
      return;
    }
    if (isCareAnimationPlaying || careActionPendingRef.current) return;

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
    pet.name,
    playActionMood,
    recordInteraction,
    showSpeech,
    t,
    wakePet,
  ]);

  const handleFeed = useCallback(() => {
    if (feedPet()) showSpeech(t("home.enjoyedSnack", { name: pet.name }));
  }, [feedPet, pet.name, showSpeech, t]);

  const handlePlay = useCallback(
    (activity: CatPlayActivity) => {
      const wasAsleep = pet.isAsleep === true;

      if (
        isCareAnimationPlaying ||
        isCareBlocked ||
        careActionPendingRef.current
      ) {
        rejectCareAction(t("home.giveMoment", { name: pet.name }));
        return;
      }
      careActionPendingRef.current = true;
      recordInteraction();
      sendPetCommand({ type: "beginCareAction" });
      wakePet((stats) => ({
        ...stats,
        happiness: boostStat(stats.happiness, activity.happinessBoost),
      }));
      playActionMood(wasAsleep, activity.mood);
      showSpeech(t(`home.playSpeech.${activity.id}`, { name: pet.name }));
    },
    [
      isCareAnimationPlaying,
      isCareBlocked,
      pet.isAsleep,
      pet.name,
      playActionMood,
      recordInteraction,
      rejectCareAction,
      sendPetCommand,
      showSpeech,
      t,
      wakePet,
    ],
  );

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

  const handleOpenMathStats = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    router.push("/stats");
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

  const handleTogglePlacedCurtain = useCallback((instanceId: string) => {
    if (!togglePlacedCurtain(instanceId)) return;
    recordInteraction();
    triggerHaptic();
  }, [recordInteraction, togglePlacedCurtain]);

  const handleTogglePlacedDecorationPower = useCallback(
    (instanceId: string) => {
      if (!togglePlacedDecorationPower(instanceId)) return;
      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, togglePlacedDecorationPower],
  );

  const handleRotatePlacedToy = useCallback(
    (instanceId: string) => {
      if (!rotatePlacedToy(instanceId)) return;
      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, rotatePlacedToy],
  );

  const handleScalePlacedToy = useCallback(
    (instanceId: string, direction: "up" | "down") => {
      if (!scalePlacedToy(instanceId, direction)) return;
      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, scalePlacedToy],
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

  const handleFlipBed = useCallback(() => {
    const flipped = flipEquippedBed();
    if (!flipped) return;

    recordInteraction();
    triggerHaptic();
  }, [flipEquippedBed, recordInteraction]);

  const handleScaleBed = useCallback(
    (direction: "up" | "down") => {
      const scaled = scaleEquippedBed(direction);
      if (!scaled) return;

      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, scaleEquippedBed],
  );

  const handleSetRoomItemRotation = useCallback((item: RoomLayerItem, degrees: number) => {
    if (!setRoomItemRotation(item, degrees)) return;
    recordInteraction(); triggerHaptic();
  }, [recordInteraction, setRoomItemRotation]);

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
    // The cat's clock-driven sleep is temporary and must end at dawn.
    if (completedMood === "fallingAsleep" && pet.type !== 'cat') {
      setPet((current) =>
        shouldPetSleep(current) ? { ...current, isAsleep: true } : current,
      );
    }
  }, [baseVideoMood, playback, sendPetCommand, setPet, pet.type]);

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

  const savingGoal = getStoreGoalDetails(progress.storeGoal, wallet.coins, t);
  const isNativeCatPet = pet.type === "cat";
  const petAnimating = isCareAnimationPlaying;

  const renderStage = (roomPet: PetProfile, visible: boolean) => (
    <PetStage
      key={`${roomPet.homeRoomId ?? "livingRoom"}:${roomPet.roomId ?? "room1"}`}
      worldClock={worldClock}
      nativeSceneMounted={shouldMountNativeRoom(roomPet.homeRoomId ?? "livingRoom", pet.homeRoomId ?? "livingRoom", getCatHomeRoomId(pet), transition?.outgoing.homeRoomId)}
      roomVisible={visible && !transition}
      sceneSlide={transition && (visible || roomPet.homeRoomId === transition.outgoing.homeRoomId)
        ? { progress: roomSlideProgress, direction: transition.direction, outgoing: !visible } : undefined}
      onSceneReady={roomSceneReady}
      roomEntry={catEntry && catEntry.roomId === roomPet.homeRoomId ? catEntry.entry : undefined}
      homeRoomId={roomPet.homeRoomId}
      onVisitHomeRoom={handleVisitRoom}
      catHomeRoomId={getCatHomeRoomId(pet)}
      onSendCatToRoom={handleCatRoomArrival}
      onOpenStore={handleOpenStore}
      roomEditor={roomEditor}
      compact
      name={pet.name}
      petType={pet.type}
      catSkinId={pet.catSkinId}
      stats={pet.stats}
      wisdom={computePetWisdom(progress.puzzlesSolved, progress.completedPuzzleIds)}
      roomId={roomPet.roomId}
      roomPetOffset={roomPet.roomPetOffset}
      bedId={roomPet.bedId}
      roomBedOffset={roomPet.roomBedOffset}
      bedFlipped={roomPet.bedFlipped}
      bedRotationDegrees={roomPet.bedRotationDegrees}
      bedScale={roomPet.bedScale}
      placedToys={roomPet.placedToys}
      placedDecorations={roomPet.placedDecorations}
      roomLayerOrder={roomPet.roomLayerOrder}
      ownedToyIds={progress.toysUnlocked}
      lastInteractionAt={pet.lastInteractionAt}
      roomActivityBlocked={isCareAnimationPlaying || isCareBlocked}
      onRoomInteraction={recordInteraction}
      onRoomActivityChange={visible ? handleRoomActivityChange : undefined}
      onFeed={handleFeed}
      onPlay={handlePlay}
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
      onTogglePlacedDecorationPower={handleTogglePlacedDecorationPower}
      onTogglePlacedCurtain={handleTogglePlacedCurtain}
      onAimPlacedSpotlight={(id, angle, swivel) => { if (aimPlacedSpotlight(id, angle, swivel)) recordInteraction(); }}
      onScalePlacedDecoration={handleScalePlacedDecoration}
      onMoveRoomLayerItem={handleMoveRoomLayerItem}
      onBedRemove={handleRemoveBed}
      onFlipBed={handleFlipBed}
      onScaleBed={handleScaleBed}
      onPlacedToyRemove={handleRemoveToy}
      onScalePlacedToy={handleScalePlacedToy}
      onRotatePlacedToy={handleRotatePlacedToy}
      onSetRoomItemRotation={handleSetRoomItemRotation}
      onOpenMathStats={handleOpenMathStats}
      onAnimationComplete={handleAnimationComplete}
    />
  );

  const viewRoom = pet.homeRoomId ?? "livingRoom";
  const stageRooms = Array.from(new Map([
    ...(isNativeCatPet ? preloadedRooms : [pet]), ...(transition ? [transition.outgoing] : []),
  ].map(room => [room.homeRoomId ?? "livingRoom", room])).values());

  return (
    <View style={[styles.safe, screenInsets]}>
      <View style={styles.screen}>
        <View style={styles.header}>
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
              <AppIcon name="settings" size={moderateScale(18) * 1.2} />
            </HeaderChip>
          </View>
        </View>

        <View style={styles.middle}>
          <View style={styles.stageWrap}>
            <WorldClockControl/>
            {stageRooms.map(room => {
              const id = room.homeRoomId ?? "livingRoom";
              const visible = id === viewRoom;
              const shown = visible || id === transition?.outgoing.homeRoomId;
              return <View key={id} style={[StyleSheet.absoluteFill, { opacity: shown ? 1 : 0 }]}
                pointerEvents={visible && !transition ? "auto" : "none"}
                accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
                {renderStage(room, visible)}
              </View>;
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={handlePlayPuzzle}
            accessibilityRole="button"
            accessibilityLabel={t("home.a11ySolve")}
          >
            <View style={styles.primaryTitle}>
              <AppIcon name="puzzles" size={moderateScale(28)} />
              <Text style={styles.primaryBtnText}>{t("home.solvePuzzle")}</Text>
            </View>
            <Text style={styles.primaryBtnHint}>
              {savingGoal
                ? t("store.goalProgress", {
                    name: savingGoal.name,
                    remaining: savingGoal.remaining,
                  })
                : t("home.solvePuzzleHint", { name: pet.name })}
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
  stageWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
  },
  footer: {
    gap: moderateScale(10),
  },
  primaryTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
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
