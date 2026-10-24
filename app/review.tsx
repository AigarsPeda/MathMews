import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { IconText as Text } from '@/components/ui/IconText';
import { BackButtonLabel } from '@/components/ui/BackButtonLabel';
import { PuzzleLives } from '@/components/puzzle/PuzzleLives';
import { LEARNING_CATALOG } from '@/constants/curriculum';
import { GameColors } from '@/constants/game';
import { getLearningReview } from '@/constants/learning-review';
import { useGame } from '@/contexts/GameProvider';
import { useLocale } from '@/contexts/LocaleProvider';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { applyLifeRegen } from '@/utils/lives';

export default function ReviewScreen() {
  const {lesson: lessonId}=useLocalSearchParams<{lesson?:string}>();
  const scroll=useRef<ScrollView>(null);
  const router=useRouter(), {t}=useTranslation(), {locale}=useLocale();
  const {isReady,hasCompletedOnboarding,progress,answerLearningReview}=useGame();
  const now=useWorldClockNow(1000,true);
  const [day]=useState(()=>Math.floor(Date.now()/86400000));
  const lesson=LEARNING_CATALOG.lessons.find(l=>l.id===lessonId);
  const [selected,setSelected]=useState<number|null>(null),[result,setResult]=useState<boolean|null>(null);
  const lives=applyLifeRegen(progress.lives,now);
  if(!isReady)return <View style={styles.safe}><ActivityIndicator color={GameColors.primary}/></View>;
  if(!hasCompletedOnboarding)return <Redirect href="/onboarding/name-pet"/>;
  if(!lesson)return <Redirect href="/puzzles"/>;
  const question=getLearningReview(lesson,day),done=progress.reviewAttemptKeys?.includes(`${lesson.id}/${day}`)??false;
  const stale=day!==Math.floor(now/86400000);
  const canCheck=!done&&!stale&&lives.current>0&&selected!==null;
  const back=()=>router.canGoBack()?router.back():router.replace('/puzzles');
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={back} accessibilityRole="button" style={styles.button}><BackButtonLabel/></Pressable><PuzzleLives lives={lives} onPress={()=>router.push('/puzzles')}/></View>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} onContentSizeChange={()=>{if(result!==null)scroll.current?.scrollToEnd({animated:false});}}>
      <Text style={styles.title} accessibilityRole="header">{t('guided.review')}</Text><Text style={styles.subtitle}>{lesson.title[locale]}</Text>
      <Text style={styles.body}>{t('guided.reviewPolicy')}</Text>
      {!done || result!==null ? <>
        <Text style={styles.question}>{question.prompt[locale]}</Text>
        {question.diagram ? <View style={styles.diagram} accessible accessibilityLabel={t('guided.reviewDiagram',{colored:question.diagram.colored,total:question.diagram.parts})}>{Array.from({length:question.diagram.parts},(_,i)=><View key={i} style={[styles.piece,i<question.diagram!.colored&&styles.colored]}/>)}</View>:null}
        {question.choices.map((choice,index)=><Pressable key={`${day}-${index}`} accessibilityRole="button" accessibilityState={{selected:selected===index,disabled:done}} disabled={done} onPress={()=>setSelected(index)} style={[styles.choice,selected===index&&styles.selected]}><Text style={styles.subtitle}>{choice}</Text></Pressable>)}
      </>:null}
      {result!==null?<View accessibilityLiveRegion="polite"><Text style={styles.subtitle}>{t(result?'guided.reviewCorrect':'guided.reviewTry')}</Text><Text style={styles.body}>{question.explanation[locale]}</Text></View>:done?<Text style={styles.body}>{t('guided.reviewDone')}</Text>:null}
      {stale?<Text style={styles.body}>{t('guided.reviewStale')}</Text>:null}
      {lives.current===0&&!done?<Text style={styles.body}>{t('guided.reviewNoLives')}</Text>:null}
    </ScrollView>
    <View style={styles.content}>
      {!done?<Pressable disabled={!canCheck} accessibilityRole="button" accessibilityState={{disabled:!canCheck}} onPress={()=>{if(selected!==null)setResult(answerLearningReview(lesson.id,day,selected));}} style={[styles.primary,!canCheck&&styles.disabled]}><Text style={styles.primaryText}>{t('play.checkAnswer')}</Text></Pressable>:null}
      <Pressable accessibilityRole="button" style={styles.button} onPress={()=>router.replace({pathname:'/learn',params:{lesson:lesson.id}})}><Text style={styles.link}>{t('guided.title')}</Text></Pressable>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:GameColors.background},header:{paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},content:{padding:20,gap:16},title:{fontSize:26,fontWeight:'800',color:GameColors.text},subtitle:{fontSize:18,lineHeight:25,fontWeight:'700',color:GameColors.text},body:{fontSize:16,lineHeight:23,color:GameColors.text},question:{fontSize:21,lineHeight:29,fontWeight:'700',color:GameColors.text},choice:{padding:16,borderWidth:2,borderColor:GameColors.cardBorder,borderRadius:14,backgroundColor:GameColors.card,minHeight:52},selected:{borderColor:GameColors.secondaryDark,backgroundColor:'#E8FAF8'},button:{minHeight:48,padding:10,justifyContent:'center',alignItems:'center'},primary:{padding:16,minHeight:54,borderRadius:16,backgroundColor:GameColors.primary,alignItems:'center'},primaryText:{fontSize:18,fontWeight:'800',color:GameColors.card},disabled:{opacity:0.5},link:{fontSize:17,fontWeight:'700',color:GameColors.secondaryDark},diagram:{flexDirection:'row',minHeight:70,gap:3},piece:{flex:1,borderWidth:1,borderColor:GameColors.secondaryDark,backgroundColor:GameColors.card},colored:{backgroundColor:GameColors.secondary}});
