import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACTIVE_SAVE_ID_KEY = "@mathmews/active-save-id";

export function createSaveId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getActiveSaveId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SAVE_ID_KEY);
  return raw && raw.length > 0 ? raw : null;
}

export async function setActiveSaveId(saveId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SAVE_ID_KEY, saveId);
}

export async function clearActiveSaveId(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SAVE_ID_KEY);
}
