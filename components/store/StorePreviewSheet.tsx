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

type Props = { item: StorePreviewItem | null; pet: PetProfile; coins: number; onClose: () => void; onSaveGoal: () => void };
export function StorePreviewSheet({ item, pet, coins, onClose, onSaveGoal }: Props) {
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
  const toys = [...(pet.placedToys ?? []), ...(item.kind === "toy" ? [{ toyId: item.id as CatToyId, instanceId: "preview-toy", offset: { x: .4, y: .5 } }] : [])];
  const decorations = [...(pet.placedDecorations ?? []), ...(item.kind === "decoration" ? [{ decorationId: item.id as CatDecorationId, scale: getDecorationDefaultPlacementScale(item.id as CatDecorationId), instanceId: "preview-decoration", offset: { x: .35, y: -.2 }, poweredOn: isBathroomLightDecorationId(item.id) }] : [])];
  const repeatable = item.kind === "toy" || item.kind === "decoration";
  const canBuy = !item.owned || repeatable;
  const price = getCatalogStorePrice(item.kind, item.id);
  const cost = price.kind === "coins" ? price.amount : 0;
  return <AppBottomSheet visible onClose={onClose} expanded>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.name.replace(/\n/g, " ")}</Text>
      {item.kind === "room" ? <Text style={styles.note}>{t(`store.roomStyles.${item.id}.description`)}</Text> : null}
      <Text style={styles.note}>{t("store.previewNote")}</Text>
      <View style={styles.room} accessibilityLabel={t("store.preview")}>
        <NativeRoomPreview pet={item.kind === "bed" ? { ...pet, bedScale: undefined, bedFlipped: false } : pet} roomId={item.kind === "room" ? item.id : pet.roomId}
          bedId={bedId} skinId={item.kind === "skin" ? item.id : pet.catSkinId} decorations={decorations} toys={toys} />
      </View>
      <StorePromotion price={price} />
      <Text style={styles.price}>{cost ? t("store.buyFor", { cost }) : t("store.free")}</Text>
      {canBuy && price.kind !== "iap" ? <Pressable style={[styles.button, coins < cost && styles.disabled]} disabled={coins < cost} accessibilityRole="button" accessibilityLabel={t(item.owned ? "store.a11yBuyAnotherDecoration" : "store.a11yBuyDecoration", { name: item.name.replace(/\n/g, " "), cost })} onPress={() => { item.onBuy(cost); onClose(); }}><Text style={styles.buttonText}>{cost ? t("store.buyFor", { cost }) : t("store.free")}</Text></Pressable> : null}
      {!item.owned && cost > 0 ? <Pressable style={styles.secondary} accessibilityRole="button" onPress={onSaveGoal}><Text style={styles.secondaryText}>{t("store.saveGoal")}</Text></Pressable> : null}
      <Pressable style={styles.secondary} accessibilityRole="button" onPress={onClose}><Text style={styles.secondaryText}>{t("store.closePreview")}</Text></Pressable>
    </ScrollView>
  </AppBottomSheet>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 }, title: { color: GameColors.text, fontSize: 22, fontWeight: "800" },
  note: { color: GameColors.textMuted, fontSize: 15 }, room: { height: 300, borderRadius: 16, overflow: "hidden" },
  price: { color: GameColors.text, fontWeight: "700", fontSize: 18 },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.primary },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" }, disabled: { opacity: .45 },
  secondary: { minHeight: 48, justifyContent: "center", alignItems: "center", backgroundColor: GameColors.background, borderRadius: 14 },
  secondaryText: { color: GameColors.text, fontWeight: "700", fontSize: 16 },
});
