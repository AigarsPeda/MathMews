import type { CatTravelMotion } from '@/utils/native-cat-locomotion';
import { useCatBedtime } from '@/hooks/use-cat-bedtime';
import type { WorldPeriod } from '@/utils/world-clock';
import { useStoreCatalog } from "@/hooks/use-store-catalog";
import { shouldMountNativeRoom } from "@/utils/native-scene-cache";
import { getCatHomeRoomId, previewHomeRoom } from "@/utils/home-rooms";
import { HOME_ROOM_IDS, roomTravelDirection, type HomeRoomId, type RoomEntry } from "@/constants/home-rooms";
import { useRoomTransition } from "@/hooks/use-room-transition";
import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { HeaderChip } from "@/components/home/HeaderChip";
import { RoomControlsTransition } from "@/components/pet/RoomControlsTransition";
import { PetStage, type RoomActivityFailureNotice } from "@/components/pet/PetStage";
import { RoomActivityNotice } from '@/components/pet/RoomActivityNotice';
import { RoomActionMenu } from "@/components/pet/RoomActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { IconText as Text } from "@/components/ui/IconText";
import type { CatBedId } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatPlayActivity } from "@/constants/cat-play";
import { getRoomPlayHappinessBoost } from "@/constants/cat-play";
import type { RoomActivityCommand, RoomActivityKind } from "@/utils/room-activities";
import type { CatToyId } from "@/constants/cat-toys";
import {
  GameColors,
  PET_HAPPINESS_BOOST,
} from "@/constants/game";
import { computePetWisdom } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useIAP } from "@/contexts/IAPProvider";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { useLocale } from "@/contexts/LocaleProvider";
import { usePetSpeech } from "@/hooks/use-pet-speech";
import { useRoomEditor } from "@/hooks/use-room-editor";
import { useScreenInsets } from "@/hooks/use-screen-insets";
import { shouldPetSleep } from "@/pet-display/engine/derive-mood";
import { usePetDisplay } from "@/pet-display/hooks/use-pet-display";
import type { PetAnimationState, PetProfile, PetStats, RoomItemOffset, RoomLayerItem } from "@/types/game";
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
import { Redirect, useFocusEffect, useRouter } from "expo-router";
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
  useStoreCatalog();
  const router = useRouter();
  const { pendingCoinCelebration, clearCoinCelebration } = useIAP();
  const { active: homeActive, reduceMotion } = useAnimationActivity();
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
    togglePlacedDecorationOpen,
    togglePlacedFridge,
    flipPlacedFridgeHinge,
    aimPlacedSpotlight,
    scalePlacedDecoration,
    visitHomeRoom,
    sendCatToRoom,
    decorationEntry,
    requestRoomDecoration,
    clearDecorationEntry,
  } = useGame();
  useFocusEffect(useCallback(() => {
    if (!isReady || !hasCompletedOnboarding) return;
    // Prepare the main destinations while idle, including after returning home.
    const task = requestIdleCallback(() => {
      router.prefetch("/puzzles");
      router.prefetch("/store");
    }, { timeout: 1500 });
    return () => cancelIdleCallback(task);
  }, [isReady, hasCompletedOnboarding, router]));
  const roomEditor = useRoomEditor(pet, setPet, progress);
  const [roomFailure, setRoomFailure] = useState<RoomActivityFailureNotice | null>(null);
  const [decoratingRoom, setDecoratingRoom] = useState<HomeRoomId | null>(null);
  const handleDecoratingChange = useCallback((roomId: HomeRoomId, active: boolean) => {
    if (active) setRoomFailure(null);
    setDecoratingRoom(current => active ? roomId : current === roomId ? null : current);
  }, []);
  const preloadedRooms = useMemo(() => HOME_ROOM_IDS.map(id => previewHomeRoom(pet, id)), [pet]);
  const { transition, progress: roomSlideProgress, visit: slideToRoom, ready: roomSceneReady } = useRoomTransition(pet, visitHomeRoom);
  const handleVisitRoom = useCallback((destination: HomeRoomId, waitForCat = false) => {
    const origin = pet.homeRoomId ?? 'livingRoom';
    if (origin === destination || transition) return;
    slideToRoom(destination, waitForCat);
  }, [pet, slideToRoom, transition]);
  const [catEntry, setCatEntry] = useState<{ roomId: HomeRoomId; entry: RoomEntry } | null>(null);
  const entrySequence = useRef(0);
  const handleCatRoomArrival = useCallback((destination: HomeRoomId, ambientPeriod?: WorldPeriod, motion?: CatTravelMotion) => {
    setCatEntry({ roomId: destination, entry: { id: ++entrySequence.current, direction: roomTravelDirection(getCatHomeRoomId(pet), destination), motion } });
    if (!ambientPeriod) handleVisitRoom(destination, true);
    sendCatToRoom(destination, !ambientPeriod);
  }, [handleVisitRoom, pet, sendCatToRoom]);
  const careActionPendingRef = useRef(false);

  const {
    playback,
    baseMood: baseVideoMood,
    send: sendPetCommand,
    isCareBlocked,
    isCareAnimationPlaying,
  } = usePetDisplay(pet, worldClock);

  const [requestedRoomCommand, setRequestedRoomCommand] = useState<{ roomId: HomeRoomId; command: RoomActivityCommand } | null>(null);
  const roomCommandSequence = useRef(0);
  const handleRoomCommand = useCallback((roomId: HomeRoomId, kind: RoomActivityKind, instanceId?: string, interactionAt?: number) => {
    if (isCareBlocked || isCareAnimationPlaying) return;
    setRoomFailure(null);
    setRequestedRoomCommand({ roomId, command: { id: ++roomCommandSequence.current, kind, instanceId, interactionAt } });
  }, [isCareAnimationPlaying, isCareBlocked]);
  const handleRoomCommandAccepted = useCallback((id: number) => {
    setRequestedRoomCommand(current => current?.command.id === id ? null : current);
  }, []);
  const handleRoomActivityFailure = useCallback((notice: RoomActivityFailureNotice) => {
    // A blocked departure happens in the cat's room, which may be offscreen.
    // Stop retrying that command and keep its recovery visible in Home.
    setRequestedRoomCommand(null);
    setRoomFailure(notice);
  }, []);
  const moveUnreachableFurniture = useCallback(() => {
    if (!roomFailure) return;
    const notice = roomFailure;
    setRoomFailure(null);
    visitHomeRoom(notice.roomId);
    notice.onMove();
  }, [roomFailure, visitHomeRoom]);
  const dismissRoomFailure = useCallback(() => {
    roomFailure?.onDismiss();
    setRoomFailure(null);
  }, [roomFailure]);

  const handleBedtime = useCallback((instanceId: string) => {
    setRequestedRoomCommand({ roomId: 'bedroom', command: {
      id: ++roomCommandSequence.current, kind: 'bedSnuggle', instanceId, ambientPeriod: 'night',
    } });
  }, []);
  const handleMorning = useCallback(() => {
    setRequestedRoomCommand(current => current?.command.ambientPeriod === 'night' ? null : current);
  }, []);
  useCatBedtime({ pet, clock: worldClock, enabled: homeActive && isReady && hasCompletedOnboarding,
    busy: isCareBlocked || isCareAnimationPlaying || !!decoratingRoom || !!decorationEntry || !!transition,
    hasCommand: !!requestedRoomCommand, onBedtime: handleBedtime, onMorning: handleMorning });

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

  useEffect(() => {
    if (!pendingCoinCelebration || !homeActive || !isReady || !hasCompletedOnboarding
      || transition || isCareAnimationPlaying) return;
    // Let the native purchase sheet dismiss before revealing the reaction.
    const timer = setTimeout(() => {
      const catRoom = getCatHomeRoomId(pet);
      if (pet.type === "cat" && (pet.homeRoomId ?? "livingRoom") !== catRoom) {
        handleVisitRoom(catRoom);
        return;
      }
      clearCoinCelebration();
      setDecoratingRoom(null);
      recordInteraction();
      showSpeech(t("iap.purchaseSuccess", { count: pendingCoinCelebration }));
      if (!reduceMotion) {
        sendPetCommand({ type: "playAction", wasAsleep: pet.isAsleep === true, mood: "dancing" });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [clearCoinCelebration, handleVisitRoom, hasCompletedOnboarding, homeActive,
    isCareAnimationPlaying, isReady, pendingCoinCelebration, pet, recordInteraction,
    reduceMotion, sendPetCommand, showSpeech, t, transition]);

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

  const handleRoomActivityCompleted = useCallback((kind: RoomActivityKind, modelId?: string) => {
    const boost = getRoomPlayHappinessBoost(kind, modelId);
    if (!boost) return;
    setPet(current => withPetCareUpdate(current, stats => ({
      ...stats, happiness: boostStat(stats.happiness, boost),
    })));
  }, [setPet]);

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
    triggerHaptic();
    router.push("/settings");
  }, [router]);

  const handleOpenStore = useCallback(() => {
    setRoomFailure(null);
    triggerHaptic();
    router.push("/store");
  }, [router]);

  const handleOpenMathStats = useCallback(() => {
    triggerHaptic();
    router.push("/stats");
  }, [router]);

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

  const handleFlipPlacedFridgeHinge = useCallback((instanceId: string) => {
    if (!flipPlacedFridgeHinge(instanceId)) return;
    recordInteraction();
    triggerHaptic();
  }, [recordInteraction, flipPlacedFridgeHinge]);

  const handleTogglePlacedFridge = useCallback((instanceId: string, opening?: "full" | "ajar") => {
    if (!togglePlacedFridge(instanceId, opening)) return;
    recordInteraction();
    triggerHaptic();
  }, [recordInteraction, togglePlacedFridge]);

  const handleTogglePlacedDecorationOpen = useCallback((instanceId: string) => {
    if (!togglePlacedDecorationOpen(instanceId)) return;
    recordInteraction();
    triggerHaptic();
  }, [recordInteraction, togglePlacedDecorationOpen]);

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
    (instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => {
      if (!scalePlacedToy(instanceId, direction, offset)) return;
      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, scalePlacedToy],
  );

  const handleScalePlacedDecoration = useCallback(
    (instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => {
      const scaled = scalePlacedDecoration(instanceId, direction, offset);
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
    (direction: "up" | "down", offset?: RoomItemOffset) => {
      const scaled = scaleEquippedBed(direction, offset);
      if (!scaled) return;

      recordInteraction();
      triggerHaptic();
    },
    [recordInteraction, scaleEquippedBed],
  );

  const handleSetRoomItemRotation = useCallback((item: RoomLayerItem, degrees: number, offset?: RoomItemOffset) => {
    if (!setRoomItemRotation(item, degrees, offset)) return;
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
    triggerHaptic();
    router.push("/puzzles");
  }, [router]);

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
      nativeSceneMounted={shouldMountNativeRoom(roomPet.homeRoomId ?? "livingRoom")}
      roomVisible={visible && !transition}
      sceneSlide={transition && (visible || roomPet.homeRoomId === transition.outgoing.homeRoomId)
        ? { progress: roomSlideProgress, direction: transition.direction, outgoing: !visible } : undefined}
      onSceneReady={roomSceneReady}
      roomEntry={catEntry && catEntry.roomId === roomPet.homeRoomId ? catEntry.entry : undefined}
      homeRoomId={roomPet.homeRoomId}
      onVisitHomeRoom={handleVisitRoom}
      catHomeRoomId={getCatHomeRoomId(pet)}
      onSendCatToRoom={handleCatRoomArrival}
      onRequestRoomCommand={handleRoomCommand}
      onRoomCommandAccepted={requestedRoomCommand?.roomId === roomPet.homeRoomId ? handleRoomCommandAccepted : undefined}
      onRoomActivityFailure={handleRoomActivityFailure}
      roomCommand={requestedRoomCommand && getCatHomeRoomId(pet) === roomPet.homeRoomId
        ? requestedRoomCommand.roomId === roomPet.homeRoomId ? requestedRoomCommand.command
          : { ...requestedRoomCommand.command, kind: 'roomTravel', instanceId: requestedRoomCommand.roomId }
        : undefined}
      onOpenStore={handleOpenStore}
      roomToolbar={{ decorating: decoratingRoom === (roomPet.homeRoomId ?? 'livingRoom'), onDecoratingChange: handleDecoratingChange }}
      decorationEntry={decorationEntry?.roomId === roomPet.homeRoomId ? decorationEntry : null}
      onDecorationEntryConsumed={clearDecorationEntry}
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
      onRoomActivityCompleted={(kind, id) => handleRoomActivityCompleted(kind,
        roomPet.placedToys?.find(item => item.instanceId === id)?.toyId
        ?? roomPet.placedDecorations?.find(item => item.instanceId === id)?.decorationId)}
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
      onTogglePlacedFridge={handleTogglePlacedFridge}
      onTogglePlacedDecorationOpen={handleTogglePlacedDecorationOpen}
      onFlipPlacedFridgeHinge={handleFlipPlacedFridgeHinge}
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
  const editingCurrentRoom = isNativeCatPet && decoratingRoom === viewRoom;
  const stageRooms = Array.from(new Map([
    ...(isNativeCatPet ? preloadedRooms : [pet]), ...(transition ? [transition.outgoing] : []),
  ].map(room => [room.homeRoomId ?? "livingRoom", room])).values());

  return (
    <View style={[styles.safe, screenInsets]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.accountRow}>
            <GameHeaderStats
              layout="home"
              coins={wallet.coins}
              streak={progress.streak}
              lives={progress.lives}
            />
            <HeaderChip
              style={styles.settingsButton}
              onPress={handleOpenSettings}
              accessibilityLabel={t("home.a11ySettings")}
            >
              <AppIcon name="settings" size={moderateScale(18) * 1.2} />
            </HeaderChip>
          </View>
          {isNativeCatPet && <View style={styles.roomToolbar}>
            <RoomActionMenu style={styles.decorationMenu} blocked={!!transition}
              label={t(editingCurrentRoom ? 'home.decoratingNow' : 'home.decorateRoom')} actions={[
                { label: t('home.decorateRoom'), icon: 'sofa', disabled: editingCurrentRoom,
                  onPress: () => { triggerHaptic(); requestRoomDecoration(); } },
                { label: t('home.shop'), icon: 'store', onPress: handleOpenStore },
              ]}>
              <View style={styles.modeHeaderContent}>
                <RoomControlsTransition visible={!editingCurrentRoom} instant={reduceMotion || !homeActive} style={styles.modeHeaderContent}>
                  <View style={styles.shopButton}>
                    <AppIcon name="sofa" size={moderateScale(19)}/>
                    <View style={styles.menuLabel}>
                      <Text style={styles.shopLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{t('home.decorateRoom')}</Text>
                      <AppIcon name="chevron-down" size={moderateScale(10)}/>
                    </View>
                  </View>
                </RoomControlsTransition>
                <RoomControlsTransition visible={editingCurrentRoom} instant={reduceMotion || !homeActive} style={StyleSheet.absoluteFill}>
                  <View style={[styles.shopButton, styles.doneButton]}>
                    <AppIcon name="sofa" size={moderateScale(19)}/>
                    <View style={styles.menuLabel}>
                      <Text style={styles.shopLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{t('home.decoratingNow')}</Text>
                      <AppIcon name="chevron-down" size={moderateScale(10)}/>
                    </View>
                  </View>
                </RoomControlsTransition>
              </View>
            </RoomActionMenu>
            <WorldClockControl inline/>
          </View>}
        </View>

        <View style={styles.middle}>
          <View style={styles.stageWrap}>
            {!isNativeCatPet && <WorldClockControl/>}
            {stageRooms.map(room => {
              const id = room.homeRoomId ?? "livingRoom";
              const visible = id === viewRoom;
              // Keep the outgoing buffer visible until the incoming cat has painted.
              // Native transform updates can arrive after this React commit.
              const shown = transition ? id === transition.outgoing.homeRoomId : visible;
              return <View key={id} style={[StyleSheet.absoluteFill, { opacity: shown ? 1 : 0 }]}
                pointerEvents={visible && !transition ? "auto" : "none"}
                accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
                {renderStage(room, visible)}
              </View>;
            })}
            {roomFailure && !editingCurrentRoom && !isCareBlocked && !isCareAnimationPlaying && !transition &&
              <View style={styles.roomFailureNotice}>
                <RoomActivityNotice name={pet.name} target={roomFailure.target}
                  onMove={moveUnreachableFurniture} onDismiss={dismissRoomFailure} />
              </View>}
          </View>
        </View>

        <View style={styles.footer}>
          <RoomControlsTransition visible={!editingCurrentRoom} instant={reduceMotion || !homeActive} offsetY={6}>
            <Pressable style={styles.primaryBtn} onPress={handlePlayPuzzle} disabled={editingCurrentRoom}
              accessibilityRole="button" accessibilityLabel={t("home.a11ySolve")}>
              <View style={styles.primaryTitle}>
                <AppIcon name="puzzles" size={moderateScale(28)} />
                <Text style={styles.primaryBtnText}>{t("home.solvePuzzle")}</Text>
              </View>
              <Text style={styles.primaryBtnHint}>
                {savingGoal ? t("store.goalProgress", { name: savingGoal.name, remaining: savingGoal.remaining })
                  : t("home.solvePuzzleHint", { name: pet.name })}
              </Text>
            </Pressable>
          </RoomControlsTransition>
          <RoomControlsTransition visible={editingCurrentRoom} instant={reduceMotion || !homeActive} offsetY={6} style={StyleSheet.absoluteFill}>
            <Pressable style={[styles.primaryBtn, styles.finishDecoratingButton]} disabled={!editingCurrentRoom}
              onPress={() => { recordInteraction(); triggerHaptic(); setDecoratingRoom(null); }}
              accessibilityRole="button" accessibilityLabel={t("home.finishDecorating")}>
              <View style={styles.primaryTitle}>
                <AppIcon name="check" size={moderateScale(28)} style={{ tintColor: GameColors.card }} />
                <Text style={[styles.primaryBtnText, styles.finishDecoratingText]}>{t("home.finishDecorating")}</Text>
              </View>
              <Text style={[styles.primaryBtnHint, styles.finishDecoratingText]}>{t("home.savedAsYouGo")}</Text>
            </Pressable>
          </RoomControlsTransition>
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
    gap: moderateScale(8),
    marginBottom: moderateScale(10),
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GameColors.card,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    borderRadius: moderateScale(16),
    paddingRight: moderateScale(6),
  },
  settingsButton: { borderWidth: 0, backgroundColor: 'transparent' },
  roomToolbar: { flexDirection: 'row', alignItems: 'stretch', gap: moderateScale(8) },
  decorationMenu: { flex: 1, minWidth: 0, minHeight: 56 },
  modeHeaderContent: { flex: 1, minHeight: 56 },
  menuLabel: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(4) },
  shopButton: { flex: 1, minWidth: 0, minHeight: 56, justifyContent: 'center', alignItems: 'center', gap: moderateScale(3), paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(8), backgroundColor: '#E8FAF8', borderRadius: moderateScale(12), borderWidth: 1, borderColor: GameColors.secondary },
  doneButton: { backgroundColor: GameColors.cardBorder, borderColor: GameColors.cardBorder },
  shopLabel: { color: GameColors.text, fontSize: moderateScale(13), fontWeight: '700' },
  roomFailureNotice: { position: 'absolute', top: moderateScale(10), left: moderateScale(22), right: moderateScale(22) },
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
  finishDecoratingButton: { flex: 1, justifyContent: "center", backgroundColor: GameColors.secondaryDark, shadowColor: GameColors.text, shadowOpacity: .12 },
  finishDecoratingText: { color: GameColors.card },
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
