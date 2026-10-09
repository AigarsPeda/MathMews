import type { PetProfile, RoomLayerItem } from "@/types/game";

/** Extra yaw relative to an item's existing model/style and wall orientation. */
export function normalizeRotationDegrees(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return ((Math.round((value % 360) * 10) + 3600) % 3600) / 10 || undefined;
}

type RotationLayout = Pick<PetProfile, "bedId" | "bedRotationDegrees" | "placedDecorations" | "placedToys">;
export function getRoomItemRotation(layout: RotationLayout, item: RoomLayerItem): number {
  const angle = item.kind === "bed" ? layout.bedRotationDegrees
    : item.kind === "toy" ? layout.placedToys?.find(entry => entry.instanceId === item.instanceId)?.rotationDegrees
    : layout.placedDecorations?.find(entry => entry.instanceId === item.instanceId)?.rotationDegrees;
  return normalizeRotationDegrees(angle) ?? 0;
}

export function setRoomItemRotation(pet: PetProfile, item: RoomLayerItem, degrees: number): PetProfile {
  if (!Number.isFinite(degrees)) return pet;
  const rotationDegrees = normalizeRotationDegrees(degrees);
  if (getRoomItemRotation(pet, item) === (rotationDegrees ?? 0)) return pet;
  if (item.kind === "bed") return pet.bedId ? { ...pet, bedRotationDegrees: rotationDegrees } : pet;
  if (item.kind === "toy") {
    if (!pet.placedToys?.some(entry => entry.instanceId === item.instanceId)) return pet;
    return { ...pet, placedToys: pet.placedToys.map(entry => entry.instanceId === item.instanceId ? { ...entry, rotationDegrees } : entry) };
  }
  if (!pet.placedDecorations?.some(entry => entry.instanceId === item.instanceId)) return pet;
  return { ...pet, placedDecorations: pet.placedDecorations.map(entry => entry.instanceId === item.instanceId ? { ...entry, rotationDegrees } : entry) };
}
