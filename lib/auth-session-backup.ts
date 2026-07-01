import * as SecureStore from "expo-secure-store";

const SESSION_BACKUP_KEY = "brainpet.auth.session";

type StoredSession = {
  refresh_token: string;
  access_token: string;
};

export async function loadBackedUpSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_BACKUP_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as StoredSession).refresh_token !== "string" ||
      typeof (parsed as StoredSession).access_token !== "string"
    ) {
      return null;
    }

    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export async function saveBackedUpSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(
    SESSION_BACKUP_KEY,
    JSON.stringify({
      refresh_token: session.refresh_token,
      access_token: session.access_token,
    }),
  );
}

export async function clearBackedUpSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_BACKUP_KEY);
}
