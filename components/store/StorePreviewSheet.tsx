import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { PetRoomBackground } from "@/components/pet/PetRoomBackground";
import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId, getPlacedDecorationWallFlipped } from "@/constants/decoration-variants";
import { getToyDisplaySize } from "@/constants/cat-toys";
import { normalizeRoomLayerOrder, roomLayerItemKey } from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { getCatBedSource, getBedDisplaySize } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import { PetDisplay } from "@/pet-display/components/PetDisplay";
import { GameColors } from "@/constants/game";
import type { PetProfile, Progress } from "@/types/game";
import type { StorePrice } from "@/types/store";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type StorePreviewItem = { kind: NonNullable<Progress["storeGoal"]>["kind"]; id: string; name: string; price: StorePrice; owned: boolean; onBuy: () => void };

type Props = { item: StorePreviewItem | null; pet: PetProfile; coins: number; onClose: () => void; onSaveGoal: () => void };
export function StorePreviewSheet({ item, pet, coins, onClose, onSaveGoal }: Props) {
  const { t } = useTranslation();
  if (!item) return null;
  const bedId = item.kind === "bed" ? item.id : pet.bedId;
  const bedSize = moderateScale(getBedDisplaySize(bedId) * (item.kind === "bed" ? 1 : pet.bedScale ?? 1));
  const toys = [...(pet.placedToys ?? []), ...(item.kind === "toy" ? [{ toyId: item.id as CatToyId, instanceId: "preview-toy", offset: { x: .4, y: .5 } }] : [])];
  const decorations = [...(pet.placedDecorations ?? []), ...(item.kind === "decoration" ? [{ decorationId: item.id as CatDecorationId, instanceId: "preview-decoration", offset: { x: .35, y: -.2 } }] : [])];
  const repeatable = item.kind === "toy" || item.kind === "decoration";
  const canBuy = !item.owned || repeatable;
  const layerOrder = normalizeRoomLayerOrder({ bedId, placedToys: toys, placedDecorations: decorations, roomLayerOrder: pet.roomLayerOrder });
  const layerIndex = (key: string) => layerOrder.findIndex(layer => roomLayerItemKey(layer) === key);
  const cost = item.price.kind === "coins" ? item.price.amount : 0;
  return <AppBottomSheet visible onClose={onClose} expanded>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.name.replace(/\n/g, " ")}</Text>
      <Text style={styles.note}>{t("store.previewNote")}</Text>
      <View style={styles.room} accessibilityLabel={t("store.preview")}>
        <PetRoomBackground roomId={item.kind === "room" ? item.id : pet.roomId} />
        {bedId ? <DraggableRoomPet petSize={bedSize} layerZIndex={layerIndex("bed")} selected={item.kind === "bed"} initialOffset={pet.roomBedOffset ?? { x: -.45, y: .3 }} interactive={false}><Image source={getCatBedSource(bedId)} style={{ width: bedSize, height: bedSize, transform: [{ scaleX: item.kind !== "bed" && pet.bedFlipped ? -1 : 1 }] }} resizeMode="contain" /></DraggableRoomPet> : null}
        {decorations.map(object => <DraggableRoomPet key={object.instanceId} petSize={moderateScale(getPlacedDecorationDragSize(object))} layerZIndex={layerIndex(`decoration:${object.instanceId}`)} selected={object.instanceId === "preview-decoration"} initialOffset={object.offset} interactive={false}><DecorationSpriteImage decorationId={getPlacedDecorationSpriteId(object)} size={moderateScale(getPlacedDecorationDragSize(object))} flipHorizontal={getPlacedDecorationWallFlipped(object)} /></DraggableRoomPet>)}
        {toys.map(object => <DraggableRoomPet key={object.instanceId} petSize={moderateScale(getToyDisplaySize(object.toyId))} layerZIndex={layerIndex(`toy:${object.instanceId}`)} selected={object.instanceId === "preview-toy"} initialOffset={object.offset} interactive={false}><ToySpriteImage toyId={object.toyId as CatToyId} size={moderateScale(getToyDisplaySize(object.toyId))} /></DraggableRoomPet>)}
        <DraggableRoomPet petSize={100} initialOffset={pet.roomPetOffset} interactive={false} layerZIndex={layerOrder.length + 1}><PetDisplay petType={pet.type} catSkinId={item.kind === "skin" ? item.id : pet.catSkinId} mood="idle" width={100} transparentBackground /></DraggableRoomPet>
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
