import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

const REMINDER_DURATION_MS = 3500;

/** Show each reminder briefly, with care feedback taking priority. */
export function usePetSpeech(contextualSpeech: string | null) {
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const contextualRef = useRef(contextualSpeech);
  const focusedRef = useRef(false);
  const actionActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const displaySpeech = useCallback((message: string | null, durationMs: number) => {
    clearTimer();
    setSpeechMessage(message);
    if (message === null) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      actionActiveRef.current = false;
      setSpeechMessage(null);
    }, durationMs);
  }, [clearTimer]);

  useEffect(() => {
    contextualRef.current = contextualSpeech;
    if (focusedRef.current && !actionActiveRef.current) {
      displaySpeech(contextualSpeech, REMINDER_DURATION_MS);
    }
  }, [contextualSpeech, displaySpeech]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    actionActiveRef.current = false;
    displaySpeech(contextualRef.current, REMINDER_DURATION_MS);
    return () => {
      focusedRef.current = false;
      actionActiveRef.current = false;
      clearTimer();
      setSpeechMessage(null);
    };
  }, [clearTimer, displaySpeech]));

  const showSpeech = useCallback((text: string, durationMs = 2800) => {
    if (!focusedRef.current) return;
    actionActiveRef.current = true;
    displaySpeech(text, durationMs);
  }, [displaySpeech]);

  return { speechMessage, showSpeech };
}
