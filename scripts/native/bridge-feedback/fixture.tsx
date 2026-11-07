/** Production retry screen with an in-memory save; never writes player progress. */
import { PlaySession } from '@/app/play';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import { PUZZLE_PATHS } from '@/constants/puzzle-path';
import { createDefaultGameSave } from '@/utils/game-storage';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import type { AppLocale } from '@/types/locale';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';
const PREVIOUS_FAST_REFRESH = true;
const lessons = ['medium-multiplication-explore-8','medium-subtraction-explore-8','medium-addition-explore-8','medium-operations-explore-9'];
const locales: AppLocale[] = ['en','lv','ru'];
export default function BridgeFeedbackFixture() {
  const realGame = useGame();
  const [slot,setSlot] = useState(0), [save,setSave] = useState(createDefaultGameSave);
  const current = useRef(save);
  const [language] = useState(()=>i18n.cloneInstance({lng:'en'}));
  const locale = locales[Math.floor(slot/4)];
  const lesson = PUZZLE_PATHS.find(l=>l.id===lessons[slot%4])!, level = lesson.levels[0];
  useEffect(()=>{
    if(!__DEV__)return;
    const settings=TurboModuleRegistry.getEnforcing<TurboModule & {setHotLoadingEnabled(enabled:boolean):void}>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return ()=>settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  },[]);
  if(!__DEV__)return <Redirect href="/"/>;
  const game = {...realGame, pet:save.pet, wallet:save.wallet, progress:save.progress, isReady:true, hasCompletedOnboarding:true,
    recordInteraction(){return 0;}, recordLearningHelp(){}, purchaseVisualHelp:()=>true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct:boolean, id:string) {
      const result=applyPuzzleAnswer(current.current,puzzle,correct,id);
      if(!result.accepted)return null;
      current.current=result.save;setSave(result.save);return result.coins;
    },
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{locale,isReady:true,setLocale:async()=>{}}}><GameContext.Provider value={game}>
    <View style={{flex:1,backgroundColor:'#FFFFFF'}}>
      <View style={{flex:1,width:locale==='en'?'100%':320,alignSelf:'center'}}><PlaySession key={slot} session={{lesson,level,phase:0}}/></View>
      <View style={{flexDirection:'row',justifyContent:'space-around',paddingBottom:12}}>
        <Text testID="feedback-lives">{`Lives ${save.progress.lives.current}`}</Text>
        <Pressable testID="feedback-next" accessibilityRole="button" style={{padding:12,minHeight:44}} onPress={async()=>{
          const next=(slot+1)%12;await language.changeLanguage(locales[Math.floor(next/4)]);
          const fresh=createDefaultGameSave();current.current=fresh;setSave(fresh);setSlot(next);
        }}><Text>Next example</Text></Pressable>
      </View>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
