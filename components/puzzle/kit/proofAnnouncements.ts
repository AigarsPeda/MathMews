import { AccessibilityInfo } from 'react-native';

/** Each playback owns one pending utterance. Replacing it coalesces quick counts. */
export function createProofAnnouncer() {
  let pending: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    if (pending !== undefined) clearTimeout(pending);
    pending = undefined;
  }
  function announce(message: string, delay = 0) {
    cancel();
    if (!message) return;
    pending = setTimeout(() => {
      pending = undefined;
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: false });
    }, delay);
  }
  return { announce, cancel };
}
