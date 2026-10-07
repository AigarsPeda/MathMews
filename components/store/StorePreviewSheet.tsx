import { getDecorationDefaultPlacementScale } from "@/constants/decoration-variants";
import { NativeRoomPreview } from "@/components/pet/native/NativeRoomPreview";
import { IconText as Text } from "@/components/ui/IconText";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import { GameColors } from "@/constants/game";
import type { PetProfile, Progress } from "@/types/game";
import type { StorePrice } from "@/types/store";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

export type StorePreviewItem = { kind: NonNullable<Progress["storeGoal"]>["kind"]; id: string; name: string; price: StorePrice; owned: boolean; onBuy: () => void };

type Props = { item: StorePreviewItem | null; pet: PetProfile; coins: number; onClose: () => void; onSaveGoal: () => void };
export function StorePreviewSheet({ item, pet, coins, onClose, onSaveGoal }: Props) {
  const { t } = useTranslation();
  if (!item) return null;
  const bedId = item.kind === "bed" ? item.id : pet.bedId;
  const toys = [...(pet.placedToys ?? []), ...(item.kind === "toy" ? [{ toyId: item.id as CatToyId, instanceId: "preview-toy", offset: { x: .4, y: .5 } }] : [])];
  const decorations = [...(pet.placedDecorations ?? []), ...(item.kind === "decoration" ? [{ decorationId: item.id as CatDecorationId, scale: getDecorationDefaultPlacementScale(item.id as CatDecorationId), instanceId: "preview-decoration", offset: { x: .35, y: -.2 } }] : [])];
  const repeatable = item.kind === "toy" || item.kind === "decoration";
  const canBuy = !item.owned || repeatable;
  const cost = item.price.kind === "coins" ? item.price.amount : 0;
  return <AppBottomSheet visible onClose={onClose} expanded>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.name.replace(/\n/g, " ")}</Text>
      <Text style={styles.note}>{t("store.previewNote")}</Text>
      <View style={styles.room} accessibilityLabel={t("store.preview")}>
        <NativeRoomPreview pet={item.kind === "bed" ? { ...pet, bedScale: undefined, bedFlipped: false } : pet} roomId={item.kind === "room" ? item.id : pet.roomId}
          bedId={bedId} skinId={item.kind === "skin" ? item.id : pet.catSkinId} decorations={decorations} toys={toys} />
      </View>
      <Text style={styles.price}>{cost ? t("store.buyFor", { cost }) : t("store.free")}</Text>
      {canBuy && item.price.kind !== "iap" ? <Pressable style={[styles.button, coins < cost && styles.disabled]} disabled={coins < cost} accessibilityRole="button" accessibilityLabel={t(item.owned ? "store.a11yBuyAnotherDecoration" : "store.a11yBuyDecoration", { name: item.name.replace(/\n/g, " "), cost })} onPress={() => { item.onBuy(); onClose(); }}><Text style={styles.buttonText}>{cost ? t("store.buyFor", { cost }) : t("store.free")}</Text></Pressable> : null}
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
