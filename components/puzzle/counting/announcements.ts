import { AccessibilityInfo } from 'react-native';

export const EXCHANGE_SPEECH_GAP_MS = 1500;

type Entry = { time: string; message: string };
const history: Entry[] = [];
export const announcementListeners = new Set<() => void>();
export const readCountingAnnouncements = () => history.slice();

export function announceCounting(message: string) {
  if (__DEV__) {
    history.push({ time: new Date().toISOString().slice(11, 23), message });
    if (history.length > 100) history.shift();
    announcementListeners.forEach(notify => notify());
  }
  AccessibilityInfo.announceForAccessibility(message);
}
