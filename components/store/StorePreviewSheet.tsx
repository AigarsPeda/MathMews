import { getToyPlacementScale } from '@/constants/cat-toys';
import { getBedPlacementScale } from '@/constants/cat-beds';
import { getCatalogStorePrice } from "@/utils/store-catalog";
import { useStoreCatalog } from "@/hooks/use-store-catalog";
import { StorePromotion } from "@/components/store/StorePromotion";
import { getDecorationDefaultPlacementScale, getPlacedDecorationSpriteId } from "@/constants/decoration-variants";
import { isBathroomLightDecorationId } from "@/constants/decoration-motion";
import { NATIVE_MODEL_SOURCES } from '@/constants/native-model-sources';
import { DEFAULT_HOME_ROOM_ID } from '@/constants/home-rooms';
import { warmHomeRoomModel } from '@/utils/native-model-warmup';
import { useEffect } from 'react';
import { NativeRoomPreview } from "@/components/pet/native/NativeRoomPreview";
import { IconText as Text } from "@/components/ui/IconText";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import { GameColors } from "@/constants/game";
import type { PetProfile, Progress } from "@/types/game";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

export type StorePreviewItem = { kind: NonNullable<Progress["storeGoal"]>["kind"]; id: string; name: string; owned: boolean; onBuy: (expectedPrice?: number) => void };

type Props = { availabilityLabel?: string; owned?: boolean; onPlace?: () => void; item: StorePreviewItem | null; pet: PetProfile; coins: number; onClose: () => void; onSaveGoal: () => void };
export function StorePreviewSheet({ item, pet, coins, owned = item?.owned, availabilityLabel, onPlace, onClose, onSaveGoal }: Props) {
  useStoreCatalog();
  const { t } = useTranslation();
  const kind = item?.kind, id = item?.id;
  const homeRoomId = pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID;
  useEffect(() => {
    if (!id) return;
    const modelId = kind === 'bed' ? `bed-${id}` : kind === 'toy' ? `toy-${id}`
      : kind === 'decoration' ? getPlacedDecorationSpriteId({ decorationId: id as CatDecorationId, instanceId: 'warmup', offset: { x: 0, y: 0 } }) : undefined;
    if (modelId) warmHomeRoomModel(homeRoomId, NATIVE_MODEL_SOURCES[modelId]);
  }, [kind, id, homeRoomId]);
  if (!item) return null;
  const bedId = item.kind === "bed" ? item.id : pet.bedId;
  const toys = [...(pet.placedToys ?? []), ...(item.kind === "toy" ? [{ toyId: item.id as CatToyId, scale: getToyPlacementScale(item.id), instanceId: "preview-toy", offset: { x: .4, y: .5 } }] : [])];
  const decorations = [...(pet.placedDecorations ?? []), ...(item.kind === "decoration" ? [{ decorationId: item.id as CatDecorationId, scale: getDecorationDefaultPlacementScale(item.id as CatDecorationId), instanceId: "preview-decoration", offset: { x: .35, y: -.2 }, poweredOn: isBathroomLightDecorationId(item.id) }] : [])];
  const repeatable = item.kind === "toy" || item.kind === "decoration";
  const canBuy = !owned || repeatable;
  const price = getCatalogStorePrice(item.kind, item.id);
  const cost = price.kind === "coins" ? price.amount : 0;
  return <AppBottomSheet visible onClose={onClose} expanded>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.name.replace(/\n/g, " ")}</Text>
      {item.kind === "room" ? <Text style={styles.note}>{t(`store.roomStyles.${item.id}.description`)}</Text> : null}
      {availabilityLabel ? <Text style={styles.note}>{availabilityLabel}</Text>
        : !owned && <Text style={styles.note}>{t("store.previewNote")}</Text>}
      <View style={styles.room} accessibilityLabel={t("store.preview")}>
        <NativeRoomPreview pet={item.kind === "bed" ? { ...pet, bedScale: getBedPlacementScale(item.id), bedFlipped: false } : pet} roomId={item.kind === "room" ? item.id : pet.roomId}
          bedId={bedId} skinId={item.kind === "skin" ? item.id : pet.catSkinId} decorations={decorations} toys={toys} />
      </View>
      <StorePromotion price={price} />
      {onPlace && <Pressable style={styles.place} accessibilityRole="button" onPress={onPlace}>
        <Text style={styles.buttonText}>{t('store.placeSpare')}</Text>
      </Pressable>}
      {canBuy && price.kind !== 'iap' && <Pressable
        style={[onPlace ? styles.secondary : styles.button, coins < cost && styles.disabled]}
        accessibilityRole="button" disabled={coins < cost} accessibilityState={{ disabled: coins < cost }}
        accessibilityLabel={t(owned ? 'store.a11yBuyAnotherDecoration' : 'store.a11yBuyDecoration', { name: item.name.replace(/\n/g, ' '), cost })}
        onPress={() => { item.onBuy(cost); onClose(); }}>
        <Text style={onPlace ? styles.secondaryText : styles.buttonText}>
          {price.kind === 'free' ? t(owned ? 'store.claimAnother' : 'store.free')
            : t(owned ? 'store.buyAnotherFor' : 'store.buyFor', { cost })}
        </Text>
      </Pressable>}
      {price.kind === 'iap' && <Text style={styles.note}>{t('store.comingSoon')}</Text>}
      {!owned && cost > 0 ? <Pressable style={styles.secondary} accessibilityRole="button" onPress={onSaveGoal}><Text style={styles.secondaryText}>{t("store.saveGoal")}</Text></Pressable> : null}
      <Pressable style={styles.secondary} accessibilityRole="button" onPress={onClose}><Text style={styles.secondaryText}>{t("store.closePreview")}</Text></Pressable>
    </ScrollView>
  </AppBottomSheet>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 }, title: { color: GameColors.text, fontSize: 22, fontWeight: "800" },
  note: { color: GameColors.textMuted, fontSize: 15 }, room: { height: 300, borderRadius: 16, overflow: "hidden" },
  place: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#23766F" },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.primary },
  buttonText: { textAlign: "center", color: "#FFFFFF", fontSize: 17, fontWeight: "700" }, disabled: { opacity: .45 },
  secondary: { minHeight: 48, justifyContent: "center", alignItems: "center", backgroundColor: GameColors.background, borderRadius: 14 },
  secondaryText: { textAlign: "center", color: GameColors.text, fontWeight: "700", fontSize: 16 },
});
