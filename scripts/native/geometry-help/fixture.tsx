/** Isolated production help player; never writes puzzle or pet progress. */
import { VisualExplanationPlayer } from '@/components/puzzle/VisualExplanationPlayer';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { VISUAL_PRACTICE } from '@/constants/visual-practice';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const PREVIOUS_FAST_REFRESH = true;
const scenarios = ['geometry_compare','geometry_missing_area','geometry_missing_perimeter'] as const;
export default function GeometryHelpFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings=TurboModuleRegistry.getEnforcing<TurboModule & {setHotLoadingEnabled(enabled:boolean):void}>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return ()=>settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language]=useState(()=>i18n.cloneInstance({lng:'en'}));
  const [slot,setSlot]=useState(0),[progress,setProgress]=useState(0);
  const key=scenarios[slot];
  if(!__DEV__)return <Redirect href="/"/>;
  return <I18nextProvider i18n={language}><SafeAreaView style={{flex:1,backgroundColor:Colors.background,width:slot===0?'100%':320,alignSelf:'center'}}>
    <Pressable testID="pilot-next" accessibilityRole="button" style={{padding:16,minHeight:48}} onPress={()=>{const next=(slot+1)%3;void language.changeLanguage(['en','lv','ru'][next]);setSlot(next);setProgress(0);}}><Text>Next example</Text></Pressable>
    <ScrollView contentContainerStyle={{padding:16,gap:16}}>
      <Text style={{fontSize:24,fontWeight:'900',color:Colors.text}}>{language.t(`visualHelp.lessons.${key}.title`)}</Text>
      <VisualExplanationPlayer key={key} explanation={{puzzleId:key,titleKey:`visualHelp.lessons.${key}.title`,keyframes:VISUAL_PRACTICE[key]}} progress={progress} onProgressChange={setProgress}/>
      <Text testID="pilot-frame">{`Frame ${Math.round(progress*2)}`}</Text>
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
