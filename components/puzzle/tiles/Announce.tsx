/**
 * Speaks a completed tap, move or removal to VoiceOver / TalkBack.
 * `accessibilityLiveRegion` only works on Android, so tile tasks render this
 * next to their status line: whenever `trigger` changes, `message` is
 * announced (the first render is silent, so opening a puzzle says nothing).
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

export function Announce({ message, trigger }: { message: string | null; trigger: unknown }) {
  const first = useRef(true);
  const text = useRef(message);
  // Keep the latest message without re-announcing when only the wording changes.
  useEffect(() => { text.current = message; });
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (text.current) AccessibilityInfo.announceForAccessibility(text.current);
  }, [trigger]);
  return null;
}
