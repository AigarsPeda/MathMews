import { AppIcon } from "@/components/ui/AppIcon";
import { IconText as Text } from "@/components/ui/IconText";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import type { AppIconName } from "@/constants/app-icons";
import { StorePreviewSheet, type StorePreviewItem } from "@/components/store/StorePreviewSheet";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { getStoreGoalDetails } from "@/utils/store-goal";
import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { CatSkinStoreCard } from "@/components/store/CatSkinStoreCard";
import { DecorationStoreCard } from "@/components/store/DecorationStoreCard";
import { ToyStoreCard } from "@/components/store/ToyStoreCard";
import { BedStoreCard } from "@/components/store/BedStoreCard";
import { RoomStoreCard } from "@/components/store/RoomStoreCard";
import { StoreTabBar, type StoreTab } from "@/components/store/StoreTabBar";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { SlideInNotificationSlot } from "@/components/ui/SlideInNotificationSlot";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { CAT_ROOM_IDS, type CatRoomId } from "@/constants/cat-rooms";
import { CAT_BED_IDS, type CatBedId } from "@/constants/cat-beds";
import { CAT_TOY_IDS, type CatToyId } from "@/constants/cat-toys";
import { CAT_SKIN_IDS, type CatSkinId } from "@/constants/cat-skins";
import { GameColors } from "@/constants/game";
import { useGame } from "@/contexts/GameProvider";
import type {
  BedPurchaseResult,
  RoomPurchaseResult,
  ToyPurchaseResult,
  DecorationPurchaseResult,
  SkinPurchaseResult,
} from "@/types/store";
import {
  getDecorationStorePrice,
  getDecorationOwnedCount,
  isDecorationUnlocked,
} from "@/utils/decoration-store";
import {
  DECORATION_STORE_CATEGORY_GROUPS,
  DECORATION_IDS_BY_STORE_TAB,
  DECORATION_STORE_SUBTITLE_KEY,
  isDecorationStoreTab,
} from "@/utils/decoration-store-sections";
import {
  countPlacedDecorations,
  countPlacedToys,
} from "@/utils/room-placement";
import {
  getToyStorePrice,
  getToyOwnedCount,
  isToyUnlocked,
} from "@/utils/toy-store";
import {
  getBedStorePrice,
  isBedUnlocked,
} from "@/utils/bed-store";
import {
  getRoomStorePrice,
  isRoomUnlocked,
} from "@/utils/room-store";
import {
  getSkinStorePrice,
  isSkinUnlocked,
} from "@/utils/skin-store";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

const FEEDBACK_VISIBLE_MS = 2800;

type StoreFeedback = {
  icon: AppIconName;
  message: string;
};

export default function StoreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    setProgress,
    purchaseRoom,
    equipRoom,
    purchaseBed,
    equipBed,
    removeBedFromRoom,
    purchaseToy,
    placeToyInRoom,
    removeToyFromRoom,
    purchaseDecoration,
    placeDecorationInRoom,
    removeDecorationFromRoom,
    purchaseSkin,
    equipSkin,
    recordInteraction,
  } = useGame();

  const unlockedRooms = progress.roomsUnlocked as CatRoomId[];
  const unlockedBeds = progress.bedsUnlocked as CatBedId[];
  const unlockedToys = progress.toysUnlocked as CatToyId[];
  const unlockedDecorations = progress.decorationsUnlocked as CatDecorationId[];
  const unlockedSkins = progress.skinsUnlocked as CatSkinId[];
  const equippedRoomId = pet.roomId as CatRoomId | undefined;
  const equippedBedId = pet.bedId as CatBedId | undefined;
  const equippedSkinId = pet.catSkinId as CatSkinId | undefined;
  const placedToys = pet.placedToys ?? [];
  const placedDecorations = useMemo(() => pet.placedDecorations ?? [], [pet.placedDecorations]);
  const [activeTab, setActiveTab] = useState<StoreTab>("living");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [preview, setPreview] = useState<StorePreviewItem | null>(null);
  const goal = getStoreGoalDetails(progress.storeGoal, wallet.coins, t);
  const [feedback, setFeedback] = useState<StoreFeedback | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleFeedbackDismissed = useCallback(() => {
    setFeedback(null);
  }, []);

  const showFeedback = useCallback(
    (icon: AppIconName, message: string) => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      setFeedback({ icon, message });
      setFeedbackVisible(true);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackVisible(false);
        feedbackTimerRef.current = null;
      }, FEEDBACK_VISIBLE_MS);
    },
    [],
  );

  const handleTabChange = useCallback(
    (tab: StoreTab) => {
      recordInteraction();
      triggerHaptic();
      setActiveTab(tab);
    },
    [recordInteraction],
  );

  const handleBack = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [recordInteraction, router]);

  const showPurchaseMessage = useCallback(
    (result: RoomPurchaseResult, roomId: CatRoomId): StoreFeedback => {
      const roomNumber = Number.parseInt(roomId.replace("room", ""), 10);
      switch (result) {
        case "purchased":
          return {
            icon: "home",
            message: t("store.purchased", { number: roomNumber }),
          };
        case "already_owned":
          return {
            icon: "check",
            message: t("store.alreadyOwned"),
          };
        case "insufficient_funds": {
          const price = getRoomStorePrice(roomId);
          const cost = price.kind === "coins" ? price.amount : 0;
          return {
            icon: "coin",
            message: t("store.needCoins", { cost }),
          };
        }
        default:
          return {
            icon: "warning",
            message: t("store.unavailable"),
          };
      }
    },
    [t],
  );

  const handleBuy = useCallback(
    (roomId: CatRoomId) => {
      recordInteraction();
      triggerHaptic();
      const result = purchaseRoom(roomId);
      if (result === "purchased") {
        triggerHaptic();
      }
      if (result !== "already_owned") {
        const { icon, message } = showPurchaseMessage(result, roomId);
        showFeedback(icon, message);
      }
    },
    [purchaseRoom, recordInteraction, showFeedback, showPurchaseMessage],
  );

  const handleEquip = useCallback(
    (roomId: CatRoomId) => {
      recordInteraction();
      triggerHaptic();
      const equipped = equipRoom(roomId);
      if (equipped) {
        const roomNumber = Number.parseInt(roomId.replace("room", ""), 10);
        showFeedback("sparkle", t("store.equippedRoom", { number: roomNumber }));
      }
    },
    [equipRoom, recordInteraction, showFeedback, t],
  );

  const showBedPurchaseMessage = useCallback(
    (result: BedPurchaseResult, bedId: CatBedId): StoreFeedback => {
      const bedName = t(`store.bedName.${bedId}`);
      switch (result) {
        case "purchased":
          return {
            icon: "bed",
            message: t("store.purchasedBed", { name: bedName }),
          };
        case "already_owned":
          return {
            icon: "check",
            message: t("store.alreadyOwnedBed"),
          };
        case "insufficient_funds": {
          const price = getBedStorePrice(bedId);
          const cost = price.kind === "coins" ? price.amount : 0;
          return {
            icon: "coin",
            message: t("store.needCoinsBed", { cost }),
          };
        }
        default:
          return {
            icon: "warning",
            message: t("store.unavailableBed"),
          };
      }
    },
    [t],
  );

  const handleBuyBed = useCallback(
    (bedId: CatBedId) => {
      recordInteraction();
      triggerHaptic();
      const result = purchaseBed(bedId);
      if (result === "purchased") {
        triggerHaptic();
      }
      if (result !== "already_owned") {
        const { icon, message } = showBedPurchaseMessage(result, bedId);
        showFeedback(icon, message);
      }
    },
    [purchaseBed, recordInteraction, showBedPurchaseMessage, showFeedback],
  );

  const handleEquipBed = useCallback(
    (bedId: CatBedId) => {
      recordInteraction();
      triggerHaptic();
      const equipped = equipBed(bedId);
      if (equipped) {
        showFeedback(
          "sparkle",
          t("store.equippedBed", { name: t(`store.bedName.${bedId}`) }),
        );
      }
    },
    [equipBed, recordInteraction, showFeedback, t],
  );

  const handleRemoveBed = useCallback(
    (bedId: CatBedId) => {
      recordInteraction();
      triggerHaptic();
      const removed = removeBedFromRoom();
      if (removed) {
        showFeedback(
          "box",
          t("store.removedFromRoom", {
            name: t(`store.bedName.${bedId}`),
          }),
        );
      }
    },
    [recordInteraction, removeBedFromRoom, showFeedback, t],
  );

  const showToyPurchaseMessage = useCallback(
    (result: ToyPurchaseResult, toyId: CatToyId): StoreFeedback => {
      const toyName = t(`store.toyName.${toyId}`).replace(/\n/g, " ");
      switch (result) {
        case "purchased":
          return {
            icon: "play",
            message: t("store.purchasedToy", { name: toyName }),
          };
        case "already_owned":
          return {
            icon: "check",
            message: t("store.alreadyOwnedToy"),
          };
        case "insufficient_funds": {
          const price = getToyStorePrice(toyId);
          const cost = price.kind === "coins" ? price.amount : 0;
          return {
            icon: "coin",
            message: t("store.needCoinsToy", { cost }),
          };
        }
        default:
          return {
            icon: "warning",
            message: t("store.unavailableToy"),
          };
      }
    },
    [t],
  );

  const handleBuyToy = useCallback(
    (toyId: CatToyId) => {
      recordInteraction();
      triggerHaptic();
      const result = purchaseToy(toyId);
      if (result === "purchased") {
        triggerHaptic();
      }
      const { icon, message } = showToyPurchaseMessage(result, toyId);
      showFeedback(icon, message);
    },
    [purchaseToy, recordInteraction, showFeedback, showToyPurchaseMessage],
  );

  const handlePlaceToy = useCallback(
    (toyId: CatToyId) => {
      recordInteraction();
      triggerHaptic();
      const placed = placeToyInRoom(toyId);
      if (placed) {
        showFeedback(
          "sparkle",
          t("store.placedToy", {
            name: t(`store.toyName.${toyId}`).replace(/\n/g, " "),
          }),
        );
      }
    },
    [placeToyInRoom, recordInteraction, showFeedback, t],
  );

  const handleRemoveToy = useCallback(
    (toyId: CatToyId) => {
      recordInteraction();
      triggerHaptic();
      const removed = removeToyFromRoom(toyId);
      if (removed) {
        showFeedback(
          "box",
          t("store.removedFromRoom", {
            name: t(`store.toyName.${toyId}`).replace(/\n/g, " "),
          }),
        );
      }
    },
    [recordInteraction, removeToyFromRoom, showFeedback, t],
  );

  const showDecorationPurchaseMessage = useCallback(
    (result: DecorationPurchaseResult, decorationId: CatDecorationId): StoreFeedback => {
      const decorationName = t(`store.decorationName.${decorationId}`).replace(
        /\n/g,
        " ",
      );
      switch (result) {
        case "purchased":
          return {
            icon: "plant",
            message: t("store.purchasedDecoration", { name: decorationName }),
          };
        case "already_owned":
          return {
            icon: "check",
            message: t("store.alreadyOwnedDecoration"),
          };
        case "insufficient_funds": {
          const price = getDecorationStorePrice(decorationId);
          const cost = price.kind === "coins" ? price.amount : 0;
          return {
            icon: "coin",
            message: t("store.needCoinsDecoration", { cost }),
          };
        }
        default:
          return {
            icon: "warning",
            message: t("store.unavailableDecoration"),
          };
      }
    },
    [t],
  );

  const handleBuyDecoration = useCallback(
    (decorationId: CatDecorationId) => {
      recordInteraction();
      triggerHaptic();
      const result = purchaseDecoration(decorationId);
      if (result === "purchased") {
        triggerHaptic();
      }
      const { icon, message } = showDecorationPurchaseMessage(
        result,
        decorationId,
      );
      showFeedback(icon, message);
    },
    [
      purchaseDecoration,
      recordInteraction,
      showDecorationPurchaseMessage,
      showFeedback,
    ],
  );

  const handlePlaceDecoration = useCallback(
    (decorationId: CatDecorationId) => {
      recordInteraction();
      triggerHaptic();
      const placed = placeDecorationInRoom(decorationId);
      if (placed) {
        showFeedback(
          "sparkle",
          t("store.placedDecoration", {
            name: t(`store.decorationName.${decorationId}`).replace(/\n/g, " "),
          }),
        );
      }
    },
    [placeDecorationInRoom, recordInteraction, showFeedback, t],
  );

  const handleRemoveDecoration = useCallback(
    (decorationId: CatDecorationId) => {
      recordInteraction();
      triggerHaptic();
      const removed = removeDecorationFromRoom(decorationId);
      if (removed) {
        showFeedback(
          "box",
          t("store.removedFromRoom", {
            name: t(`store.decorationName.${decorationId}`).replace(/\n/g, " "),
          }),
        );
      }
    },
    [recordInteraction, removeDecorationFromRoom, showFeedback, t],
  );

  const showSkinPurchaseMessage = useCallback(
    (result: SkinPurchaseResult, skinId: CatSkinId): StoreFeedback => {
      const skinName = t(`store.skinName.${skinId}`);
      switch (result) {
        case "purchased":
          return {
            icon: "cat",
            message: t("store.purchasedSkin", { name: skinName }),
          };
        case "already_owned":
          return {
            icon: "check",
            message: t("store.alreadyOwnedSkin"),
          };
        case "insufficient_funds": {
          const price = getSkinStorePrice(skinId);
          const cost = price.kind === "coins" ? price.amount : 0;
          return {
            icon: "coin",
            message: t("store.needCoinsSkin", { cost }),
          };
        }
        default:
          return {
            icon: "warning",
            message: t("store.unavailableSkin"),
          };
      }
    },
    [t],
  );

  const handleBuySkin = useCallback(
    (skinId: CatSkinId) => {
      recordInteraction();
      triggerHaptic();
      const result = purchaseSkin(skinId);
      if (result === "purchased") {
        triggerHaptic();
      }
      if (result !== "already_owned") {
        const { icon, message } = showSkinPurchaseMessage(result, skinId);
        showFeedback(icon, message);
      }
    },
    [purchaseSkin, recordInteraction, showSkinPurchaseMessage, showFeedback],
  );

  const handleEquipSkin = useCallback(
    (skinId: CatSkinId) => {
      recordInteraction();
      triggerHaptic();
      const equipped = equipSkin(skinId);
      if (equipped) {
        showFeedback(
          "sparkle",
          t("store.equippedSkin", { name: t(`store.skinName.${skinId}`) }),
        );
      }
    },
    [equipSkin, recordInteraction, showFeedback, t],
  );

  const renderDecorationCards = useCallback(
    (decorationIds: readonly CatDecorationId[]) =>
      decorationIds.filter(id => !ownedOnly || unlockedDecorations.includes(id)).map((decorationId) => {
        const price = getDecorationStorePrice(decorationId);
        const owned = isDecorationUnlocked(decorationId, unlockedDecorations);
        const canAfford =
          price.kind !== "coins" || wallet.coins >= price.amount;

        return (
          <DecorationStoreCard
            key={decorationId}
            decorationId={decorationId}
            isOwned={owned}
            placedCount={countPlacedDecorations(
              decorationId,
              placedDecorations,
            )}
            ownedCount={getDecorationOwnedCount(decorationId, progress)}
            canAfford={canAfford}
            onPreview={() => setPreview({ kind: "decoration", id: decorationId, name: t(`store.decorationName.${decorationId}`), price: getDecorationStorePrice(decorationId), owned, onBuy: () => handleBuyDecoration(decorationId) })}
                        onBuy={() => handleBuyDecoration(decorationId)}
            onPlace={() => handlePlaceDecoration(decorationId)}
            onRemove={() => handleRemoveDecoration(decorationId)}
          />
        );
      }),
    [ownedOnly, handleBuyDecoration, handlePlaceDecoration, handleRemoveDecoration, placedDecorations, progress, unlockedDecorations, wallet.coins, t],
  );

  const storeSubtitle = isDecorationStoreTab(activeTab)
    ? t(DECORATION_STORE_SUBTITLE_KEY[activeTab])
    : activeTab === "rooms"
      ? t("store.subtitleRooms")
      : activeTab === "colors"
        ? t("store.subtitleColors")
        : activeTab === "beds"
          ? t("store.subtitleBeds")
          : activeTab === "toys"
            ? t("store.subtitleToys")
            : "";

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <BackButtonLabel style={styles.backText} />
          </Pressable>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t("store.title")}</Text>
          <Text style={styles.subtitle}>{storeSubtitle}</Text>
        </View>

        <StoreTabBar active={activeTab} onChange={handleTabChange} />
        <View style={styles.filters}>
          {isDecorationStoreTab(activeTab) ? <Pressable style={styles.filter} accessibilityRole="button" onPress={() => setShowCategories(true)}><Text style={styles.filterText}>{t(`store.tab${activeTab[0].toUpperCase()}${activeTab.slice(1)}`)}</Text><AppIcon name="chevron-down" size={moderateScale(14)} /></Pressable> : null}
          <Pressable style={styles.filter} accessibilityRole="checkbox" accessibilityState={{ checked: ownedOnly }} onPress={() => setOwnedOnly(value => !value)}><View style={styles.checkbox}>{ownedOnly && <AppIcon name="check" size={moderateScale(16)} />}</View><Text style={styles.filterText}>{t("store.ownedOnly")}</Text></Pressable>
        </View>
        {goal ? <Text style={styles.goal}>{t("store.goalProgress", { name: goal.name, remaining: goal.remaining })}</Text> : null}

        <View style={styles.content}>
          <SlideInNotificationSlot
            visible={feedbackVisible}
            onDismissComplete={handleFeedbackDismissed}
          >
            {feedback ? (
              <NotificationBanner
                icon={feedback.icon}
                message={feedback.message}
              />
            ) : null}
          </SlideInNotificationSlot>

          <ScrollView
            key={activeTab}
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === "rooms"
              ? CAT_ROOM_IDS.filter(id => !ownedOnly || unlockedRooms.includes(id)).map((roomId) => {
                  const price = getRoomStorePrice(roomId);
                  const owned = isRoomUnlocked(roomId, unlockedRooms);
                  const canAfford =
                    price.kind !== "coins" || wallet.coins >= price.amount;

                  return (
                    <RoomStoreCard
                      key={roomId}
                      roomId={roomId}
                      isOwned={owned}
                      isEquipped={equippedRoomId === roomId}
                      canAfford={canAfford}
                      onPreview={() => setPreview({ kind: "room", id: roomId, name: t("store.roomName", { number: Number(roomId.replace("room", "")) }), price: getRoomStorePrice(roomId), owned, onBuy: () => handleBuy(roomId) })}
                        onBuy={() => handleBuy(roomId)}
                      onEquip={() => handleEquip(roomId)}
                    />
                  );
                })
              : activeTab === "colors"
                ? CAT_SKIN_IDS.filter(id => !ownedOnly || unlockedSkins.includes(id)).map((skinId) => {
                    const price = getSkinStorePrice(skinId);
                    const owned = isSkinUnlocked(skinId, unlockedSkins);
                    const canAfford =
                      price.kind !== "coins" || wallet.coins >= price.amount;

                    return (
                      <CatSkinStoreCard
                        key={skinId}
                        skinId={skinId}
                        isOwned={owned}
                        isEquipped={equippedSkinId === skinId}
                        canAfford={canAfford}
                        onPreview={() => setPreview({ kind: "skin", id: skinId, name: t(`store.skinName.${skinId}`), price: getSkinStorePrice(skinId), owned, onBuy: () => handleBuySkin(skinId) })}
                        onBuy={() => handleBuySkin(skinId)}
                        onEquip={() => handleEquipSkin(skinId)}
                      />
                    );
                  })
                : activeTab === "beds"
                ? CAT_BED_IDS.filter(id => !ownedOnly || unlockedBeds.includes(id)).map((bedId) => {
                    const price = getBedStorePrice(bedId);
                    const owned = isBedUnlocked(bedId, unlockedBeds);
                    const canAfford =
                      price.kind !== "coins" || wallet.coins >= price.amount;

                    return (
                      <BedStoreCard
                        key={bedId}
                        bedId={bedId}
                        isOwned={owned}
                        isEquipped={equippedBedId === bedId}
                        canAfford={canAfford}
                        onPreview={() => setPreview({ kind: "bed", id: bedId, name: t(`store.bedName.${bedId}`), price: getBedStorePrice(bedId), owned, onBuy: () => handleBuyBed(bedId) })}
                        onBuy={() => handleBuyBed(bedId)}
                        onEquip={() => handleEquipBed(bedId)}
                        onRemove={() => handleRemoveBed(bedId)}
                      />
                    );
                  })
                : activeTab === "toys"
                  ? CAT_TOY_IDS.filter(id => !ownedOnly || unlockedToys.includes(id)).map((toyId) => {
                      const price = getToyStorePrice(toyId);
                      const owned = isToyUnlocked(toyId, unlockedToys);
                      const canAfford =
                        price.kind !== "coins" || wallet.coins >= price.amount;

                      return (
                        <ToyStoreCard
                          key={toyId}
                          toyId={toyId}
                          isOwned={owned}
                          placedCount={countPlacedToys(toyId, placedToys)}
                          ownedCount={getToyOwnedCount(toyId, progress)}
                          canAfford={canAfford}
                          onPreview={() => setPreview({ kind: "toy", id: toyId, name: t(`store.toyName.${toyId}`), price: getToyStorePrice(toyId), owned, onBuy: () => handleBuyToy(toyId) })}
                        onBuy={() => handleBuyToy(toyId)}
                          onPlace={() => handlePlaceToy(toyId)}
                          onRemove={() => handleRemoveToy(toyId)}
                        />
                      );
                    })
                : isDecorationStoreTab(activeTab)
                  ? renderDecorationCards(
                      DECORATION_IDS_BY_STORE_TAB[activeTab],
                    )
                  : null}
          </ScrollView>
        </View>
      </View>
      <AppBottomSheet visible={showCategories} onClose={() => setShowCategories(false)} expanded>
        <ScrollView
          style={{ maxHeight: Math.max(0, height * 0.88 - insets.top - insets.bottom - moderateScale(48)) }}
          contentContainerStyle={styles.categories}
          nestedScrollEnabled={Platform.OS === "android"}
        >
          <Text style={styles.title}>{t("store.chooseCategory")}</Text>
          {DECORATION_STORE_CATEGORY_GROUPS.map(group => (
            <View key={group.titleKey} style={styles.categoryGroup}>
              <Text style={styles.categoryHeading} accessibilityRole="header">{t(group.titleKey)}</Text>
              <View style={styles.categoryRow}>
                {group.tabs.map(tab => (
                  <Pressable
                    key={tab}
                    style={[styles.category, activeTab === tab && styles.categorySelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeTab === tab }}
                    onPress={() => { handleTabChange(tab); setShowCategories(false); }}
                  >
                    <Text style={styles.categoryLabel}>{t(`store.tab${tab[0].toUpperCase()}${tab.slice(1)}`)}</Text>
                    {activeTab === tab ? <AppIcon name="check" size={moderateScale(18)} /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </AppBottomSheet>
      <StorePreviewSheet item={preview} pet={pet} coins={wallet.coins} onClose={() => setPreview(null)} onSaveGoal={() => {
        if (!preview) return;
        setProgress(current => ({ ...current, storeGoal: { kind: preview.kind, id: preview.id } }));
        setPreview(null);
      }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  checkbox: { width: moderateScale(18), height: moderateScale(18), borderWidth: 1.5, borderColor: GameColors.textMuted, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  filter: { flexDirection: "row", alignItems: "center", gap: moderateScale(6), minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12, backgroundColor: GameColors.card },
  filterText: { color: GameColors.text, fontSize: 14, fontWeight: "700" },
  goal: { color: GameColors.text, fontSize: 14 },
  categories: { padding: moderateScale(20), gap: moderateScale(20) },
  categoryGroup: { gap: moderateScale(8) },
  categoryHeading: { color: GameColors.textMuted, fontSize: moderateScale(15), fontWeight: "700" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: moderateScale(8) },
  category: { width: "48%", minHeight: 48, flexDirection: "row", alignItems: "center", gap: moderateScale(6), padding: moderateScale(12), justifyContent: "center", borderRadius: 12, borderWidth: 2, borderColor: "transparent", backgroundColor: GameColors.background },
  categorySelected: { borderColor: GameColors.secondary, backgroundColor: "#E8FAF8" },
  categoryLabel: { flex: 1, color: GameColors.text, fontSize: moderateScale(14), fontWeight: "700" },
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
    gap: moderateScale(12),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: "center",
    paddingRight: moderateScale(12),
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  titleBlock: {
    gap: moderateScale(4),
  },
  content: {
    flex: 1,
    minHeight: 0,
    gap: moderateScale(10),
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: moderateScale(12),
    paddingBottom: moderateScale(16),
  },
});
