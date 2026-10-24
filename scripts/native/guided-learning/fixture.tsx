/** Isolated real learning UI. Never writes the player's save or wallet. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { GuidedLearning } from '@/components/puzzle/GuidedLearning';
import { LEARNING_CATALOG } from '@/constants/curriculum';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { applyGuidedLearning } from '@/utils/learning-review';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
const fresh=()=>{const save=createDefaultGameSave();save.progress.lives={current:0,nextRegenAt:Date.now()+1800000};return save;};
export default function LearningFixture(){
 const [save,setSave]=useState(fresh),[revision,setRevision]=useState(0),[topic,setTopic]=useState('addition'),[locale,setLocale]=useState<'en'|'lv'>('en'),[narrow,setNarrow]=useState(false);
 const [language]=useState(()=>i18n.cloneInstance({lng:'en'}));
 const lesson=LEARNING_CATALOG.lessons.find(l=>topic==='subtraction'?l.difficulty==='easy'&&l.topicId==='subtraction':l.id===(topic==='addition'?'easy-addition-join':'easy-fractions-parts'))!;
 if(!__DEV__)return <Redirect href="/"/>;
 return <I18nextProvider i18n={language}><SafeAreaView style={{flex:1,backgroundColor:'#FFF5EB'}}>
  <View style={{flex:1,width:narrow?320:'100%',alignSelf:'center'}}><GuidedLearning key={`${revision}-${topic}-${locale}`} lesson={lesson} locale={locale} variant={0} petType="cat" onBack={()=>setRevision(n=>n+1)} onAnother={()=>setRevision(n=>n+1)} onFinish={()=>setSave(s=>applyGuidedLearning(s,lesson.id,`fixture-${revision}-${topic}`))}/></View>
  <Text accessibilityLabel={`QA lives ${save.progress.lives.current} coins ${save.wallet.coins} solved ${save.progress.completedPuzzleIds?.length??0} guided ${save.progress.learningEvidence?.[lesson.skillId!]?.guidedSessions??0}`}>{`QA lives ${save.progress.lives.current} coins ${save.wallet.coins} solved ${save.progress.completedPuzzleIds?.length??0} guided ${save.progress.learningEvidence?.[lesson.skillId!]?.guidedSessions??0}`}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',paddingRight:70}}>{['Reset','Fractions','Subtract','Reopen','LV','Narrow'].map(label=><Pressable key={label} accessibilityRole="button" style={{padding:10,minHeight:44}} onPress={()=>{
   if(label==='Reset'){setSave(fresh());setTopic('addition');setRevision(n=>n+1);setLocale('en');void language.changeLanguage('en');setNarrow(false);}
   if(label==='Subtract'){setTopic('subtraction');setRevision(n=>n+1);}
   if(label==='Fractions'){setTopic('fractions');setRevision(n=>n+1);}
   if(label==='Reopen'){setSave(s=>parseGameSaveFromValue(JSON.stringify(s))!.save);setRevision(n=>n+1);}
   if(label==='LV'){setLocale('lv');void language.changeLanguage('lv');}
   if(label==='Narrow')setNarrow(n=>!n);
  }}><Text>{label}</Text></Pressable>)}</View>
 </SafeAreaView></I18nextProvider>;
}
