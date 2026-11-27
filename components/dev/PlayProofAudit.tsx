import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

export type ProofFrameEvent = {
  runId: number;
  phase: 'ready' | 'landing' | 'paused' | 'playing' | 'settled' | 'skipped' | 'haptic';
  landed: number;
};

type CheckDetails = { locale: string; fontScale: number; reducedMotion: boolean; submitted: string; answerKind: string; choiceIndex?: number; choiceCount?: number };
type AuditEvent = { phase: string; runId?: number; landed?: number; time: number; frame?: number };
type Box = [number, number, number, number];
type Measurable = {
  id: string;
  children: ArrayLike<Measurable>;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number };
};

// nativeID exposes the mathematical landmarks on the public React Native element tree.
function readFrame(root: Measurable) {
  const boxes: Record<string, Box[]> = {};
  function visit(node: Measurable) {
    if (node.id.startsWith('play-proof-')) {
      const { left, top, right, bottom } = node.getBoundingClientRect();
      (boxes[node.id] ??= []).push([left, top, right, bottom]);
    }
    for (const child of Array.from(node.children)) visit(child);
  }
  visit(root);
  return { time: Date.now(), boxes };
}

/** Present only on the disposable QA route. Events sharing a native frame reuse its measurements. */
export function createPlayProofAudit(puzzleId: string, videoFrames = false) {
  const events: AuditEvent[] = [];
  const frames: ReturnType<typeof readFrame>[] = [];
  const listeners = new Set<() => void>();
  let check: CheckDetails | undefined;
  let screen: Measurable | null = null;
  let pending: number | null = null;
  let payload = JSON.stringify({ puzzleId, check, events, frames, videoFrames });
  function publish() {
    payload = JSON.stringify({ puzzleId, check, events, frames, videoFrames });
    for (const listener of listeners) listener();
  }
  return {
    bindScreen(view: View | null) {
      screen = view && 'getBoundingClientRect' in view ? view as unknown as Measurable : null;
      if (!screen && pending !== null) { cancelAnimationFrame(pending); pending = null; }
    },
    record(event: Omit<AuditEvent, 'time' | 'frame'>, details?: CheckDetails) {
      if (event.phase === 'check') { check = details; events.length = 0; frames.length = 0; }
      events.push({ ...event, time: Date.now() });
      if (!screen) { publish(); return; }
      if (pending === null) pending = requestAnimationFrame(() => {
        pending = null;
        if (!screen) return;
        const index = frames.push(readFrame(screen)) - 1;
        for (let i = events.length - 1; i >= 0 && events[i].frame === undefined; i--) events[i].frame = index;
        publish();
      });
    },
    videoFrames,
    frameCount: () => frames.length,
    read: () => payload,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
export type PlayProofAudit = ReturnType<typeof createPlayProofAudit>;
export function PlayProofAuditLog({ audit }: { audit: PlayProofAudit }) {
  const value = useSyncExternalStore(audit.subscribe, audit.read, audit.read);
  // An opt-in 36 × 4 pt timecode in the unused bottom inset aligns the MP4's
  // variable presentation times to the measured native frames. Zero is entry.
  const count = useSyncExternalStore(audit.subscribe, audit.frameCount, audit.frameCount);
  return <>
    <View testID="play-proof-audit" accessible accessibilityLabel="Play proof audit" accessibilityValue={{ text: value }}
      pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, left: 0, bottom: 0 }} />
    {audit.videoFrames && <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      pointerEvents="none" style={{ position: 'absolute', left: '18%', bottom: 3, flexDirection: 'row' }}>
      {[1, 0, 1, 0, ...Array.from({ length: 8 }, (_, bit) => (count >>> bit) & 1)].map((dark, i) =>
        <View key={i} style={{ width: 3, height: 4, backgroundColor: dark ? 'black' : 'white' }} />)}
    </View>}
  </>;
}
