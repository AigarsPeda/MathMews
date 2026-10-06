import { useStartupVisualReady } from "@/contexts/StartupVisualContext";
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { DefaultLight, FilamentScene, FilamentView, useFilamentContext } from 'react-native-filament';
import { NativeCatActor } from './NativeCatActor';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { PetPlaybackState } from '@/pet-display/types';
type Props = {
  width: number;
  skinId?: string;
  playback: PetPlaybackState;
  loop?: boolean;
  playing?: boolean;
  onReady?: () => void;
  onPress?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (index: number) => void;
};
function PortraitScene(props: Props) {
  const [ready, setReady] = useState(false);
  useStartupVisualReady(ready);
  const { camera } = useFilamentContext();
  const { active, reduceMotion } = useAnimationActivity();
  return <FilamentView style={StyleSheet.flatten(StyleSheet.absoluteFill)} enableTransparentRendering renderCallback={() => {
      'worklet';
      camera.setOrthographicProjection(-1.35, 1.35, -1.35, 1.35, .1, 40);
      camera.lookAt([3.2, 4, 10], [.04, .94, 0], [0, 1, 0]);
    }}><DefaultLight /><NativeCatActor skinId={props.skinId} playback={props.playback} loop={props.loop} active={active && props.playing !== false} reduceMotion={reduceMotion} onReady={() => { setReady(true); props.onReady?.(); }} onAnimationComplete={props.onAnimationComplete} onStepComplete={props.onStepComplete}/></FilamentView>;
}
export function NativeCatDisplay(props: Props) {
  // A native render surface is mounted only when its measurable preview is shown.
  const [visible, setVisible] = useState(false);
  return <Pressable onLayout={() => setVisible(true)} onPress={props.onPress} disabled={!props.onPress} style={{ width: props.width, height: props.width }}>
  {visible && <FilamentScene><PortraitScene {...props}/></FilamentScene>}
 </Pressable>;
}
