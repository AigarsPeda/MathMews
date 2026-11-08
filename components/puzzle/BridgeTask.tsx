import { EquationBoardModel } from '@/components/puzzle/EquationBoardModel';
import { RatioTableModel } from '@/components/puzzle/RatioTableModel';
/** Local puzzle extension: mathematical diagrams, Berry controls, shared Check.
 * Guided models fade into independent work; reset never submits or spends a life.
 */
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { NumberLineTrack } from '@/components/puzzle/NumberLineTrack';
import { DiagramColors as D, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { transformEquation, type BridgePuzzle, type BridgeState, type Point } from '@/utils/bridge-models';
import { appendGeometryDigit } from '@/utils/geometry-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = { puzzle: BridgePuzzle; value: BridgeState | null; onChange: (value: BridgeState | null) => void; answered: boolean; readOnly?: boolean };
export function BridgeTask({ puzzle, value, onChange, answered, readOnly = false }: Props) {
  const { t } = useTranslation();
  const [lastAction, setLastAction] = useState<{ puzzleId: string; equation: BridgeState['equation']; action: 'add' | 'subtract' | 'divide'; amount: number } | null>(null);
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(280);
  const button = (id: string, label: string, action: () => void, disabled = false, small = false) =>
    <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: answered || disabled }}
      disabled={answered || disabled} onPress={action} style={[styles.button, small && styles.small, (answered || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const numeric = (showAnswer = true) => readOnly ? null : <View style={styles.group}>
    {showAnswer ? <View style={styles.answerRow}><Text style={styles.note}>{t('bridge.answer')}</Text><Text testID="bridge-value" style={styles.answer}>{value?.value ?? '?'}</Text></View> : <Text style={styles.note}>{t('bridge.enterLitres')}</Text>}
    {[['1','2','3','4','5'],['6','7','8','9','0']].map((row,i)=><View key={i} style={styles.row}>{row.map(d=>button(`bridge-digit-${d}`,d,()=>onChange({value:appendGeometryDigit(value?.value??null,Number(d))}),false,true))}</View>)}
  </View>;
  let model;
  if(puzzle.type==='ratio_table') {
    model=<>
      <RatioTableModel puzzle={puzzle} answer={value?.value ?? null} />
      {numeric(false)}
    </>;
  } else if(puzzle.type==='signed_line') {
    const {min,max,start,mode,delta}=puzzle.payload;
    const current=readOnly?start:value?.value??0;
    model=<>
      <Text style={styles.equation}>{mode==='place'?String(start):`${start} ${delta<0?'−':'+'} ${Math.abs(delta)} = ?`}</Text>
      <NumberLineTrack min={min} max={max} start={mode==='place'?0:start} value={current} onSelect={n=>onChange({value:n})} disabled={answered}/>
      {!readOnly ? <Text testID="bridge-value" style={styles.answer}>{value?.value??'?'}</Text> : null}
      {!readOnly ? <View style={styles.row}>{[-1,1].map(d=>button(`bridge-step-${d}`,t(d<0?'puzzleTypes.numberLineMoveLeft':'puzzleTypes.numberLineMoveRight'),()=>onChange({value:current+d}),current+d<min||current+d>max,true))}</View> : null}
    </>;
  } else if(puzzle.type==='equation_board') {
    const {a,b,c}=puzzle.payload, equation=value?.equation??{a,b,c};
    const isolated = equation.a === 1 && equation.b === 0;
    const actionMessage = lastAction?.puzzleId === puzzle.id && lastAction.equation === value?.equation ? t(`bridge.did_${lastAction.action}`, { amount: lastAction.amount }) : null;
    const operations: ['add'|'divide',number][]=[['add',-1],['add',1],...(puzzle.difficulty==='easy'?[]:[['add',-5],['add',5],['divide',2],['divide',3],['divide',4]] as ['add'|'divide',number][])];
    model=<>
      {!readOnly ? <Text style={styles.guide}>{t('bridge.xMeaning')}</Text> : null}
      <EquationBoardModel equation={equation} />
      {readOnly ? null : isolated ? <Text testID="bridge-equation-ready" accessibilityLiveRegion="polite" style={styles.ready}>{t('bridge.equationReady')}</Text> : <>
        <Text accessibilityLiveRegion="polite" style={styles.note}>{actionMessage ?? t('bridge.chooseOperation')}</Text>
        <View testID="bridge-operations" style={styles.operations}>{operations.map(([op,n])=>{
          const candidate=transformEquation(equation,op,n);
          if (op === 'divide' && !candidate) return null;
          const next=puzzle.difficulty==='easy'&&candidate&&(candidate.b<0||candidate.c<0||candidate.c>20)?null:candidate;
          const action = op === 'divide' ? 'divide' : n < 0 ? 'subtract' : 'add';
          const label = t(`bridge.action_${action}`, { amount: Math.abs(n) });
          return <Pressable key={`${op}-${n}`} testID={`bridge-${op}-${n}`} accessibilityRole="button"
            accessibilityLabel={t(`bridge.actionBoth_${action}`, { amount: Math.abs(n) })} accessibilityState={{disabled: answered || !next}}
            disabled={answered || !next} onPress={()=>{
              if (!next) return;
              setLastAction({puzzleId:puzzle.id,equation:next,action,amount:Math.abs(n)});
              onChange({equation:next});
            }} style={[styles.button, styles.operationButton, fontScale > 1.2 && styles.largeOperation, (answered || !next) && styles.disabled]}>
              <Text style={styles.buttonText}>{label}</Text>
            </Pressable>;
        })}</View>
      </>}
    </>;
  } else {
    const {min,max,mode,start,end}=puzzle.payload, size=Math.min(184,width-36)/(max-min), side=(max-min)*size;
    const point=value?.point??{x:0,y:0};
    const position=(p:Point)=>({left:(p.x-min)*size,top:(max-p.y)*size});
    const marker=(p:Point,label:string)=> <View key={label} pointerEvents="none" style={[styles.point,position(p)]}><Text style={styles.pointLabel}>{label}</Text></View>;
    model=<>
      <Text style={styles.equation}>{mode==='plot'?`(${end.x}, ${end.y})`:mode==='translate'?`A (${start.x}, ${start.y})`:`A (${start.x}, ${start.y}) · B (${end.x}, ${end.y})`}</Text>
      {mode==='translate'?<Text style={styles.note}>{t('bridge.moveBy',{x:end.x>=0?`+${end.x}`:end.x,y:end.y>=0?`+${end.y}`:end.y})}</Text>:null}
      <View testID="bridge-grid" style={{width:side+36,height:side+36,alignSelf:'center',padding:18}}>
        <View style={{width:side,height:side,backgroundColor:D.geometrySurface}}>
          {Array.from({length:max-min+1},(_,i)=>{const n=min+i;return <View key={n} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.gridLine,{left:i*size,top:0,width:n===0?2:1,height:side,backgroundColor:n===0?D.geometryEdge:D.geometryGrid}]}/>
            <View style={[styles.gridLine,{left:0,top:(max-n)*size,width:side,height:n===0?2:1,backgroundColor:n===0?D.geometryEdge:D.geometryGrid}]}/>
            <Text style={[styles.axisLabel,{left:i*size-14,top:side+1}]}>{n}</Text><Text style={[styles.axisLabel,{left:-31,top:(max-n)*size-10}]}>{n}</Text>
          </View>;})}
          <Text style={[styles.axisName,{right:-17,top:max*size-10}]}>x</Text><Text style={[styles.axisName,{left:-min*size-5,top:-22}]}>y</Text>
          {mode!=='plot'?marker(start,'A'):null}{mode==='distance'?marker(end,'B'):null}
          {mode!=='distance'&&value?.point?marker(point,'●'):null}
          {mode!=='distance'?<Pressable testID="bridge-plot" accessible={false} disabled={answered} style={StyleSheet.absoluteFill} onPress={e=>{const x=Math.round(e.nativeEvent.locationX/size)+min,y=max-Math.round(e.nativeEvent.locationY/size);onChange({point:{x:Math.min(max,Math.max(min,x)),y:Math.min(max,Math.max(min,y))}});}}/>:null}
        </View>
      </View>
      {readOnly ? null : mode==='distance'?numeric():<View style={styles.group}>
        <Text testID="bridge-point" style={styles.answer}>{value?.point?`(${point.x}, ${point.y})`:'(?, ?)'}</Text>
        <View style={styles.operations}>{(['x','y'] as const).flatMap(axis=>[-1,1].map(d=>button(`bridge-${axis}-${d}`,`${axis} ${d>0?'+':'−'} 1`,()=>onChange({point:{...point,[axis]:point[axis]+d}}),point[axis]+d<min||point[axis]+d>max,true)))}</View>
      </View>}
    </>;
  }
  return <View style={[styles.wrap, puzzle.type === 'coordinate_map' && styles.coordinateWrap]} onLayout={e=>setWidth(e.nativeEvent.layout.width)}>
    {!readOnly && puzzle.payload.guided && puzzle.type !== 'equation_board' && puzzle.type !== 'ratio_table'?<Text style={styles.guide}>{t(`bridge.guide_${puzzle.type}`)}</Text>:null}
    {model}
    {!readOnly ? <View style={styles.footer}>
      {puzzle.type === 'signed_line' ? button('bridge-zero',t('bridge.selectZero'),()=>onChange({value:0}),false,true) : null}
      {puzzle.type === 'coordinate_map' && puzzle.payload.mode !== 'distance' ? button('bridge-origin',t('bridge.selectOrigin'),()=>onChange({point:{x:0,y:0}}),false,true) : null}
      {puzzle.type === 'ratio_table' || puzzle.type === 'coordinate_map' && puzzle.payload.mode === 'distance' ? button('bridge-erase',t('geometryModels.eraseShort'),()=>onChange({value:value?.value!=null && value.value>=10 ? Math.floor(value.value/10) : null}),false,true) : null}
      {button('bridge-reset',t('geometryModels.reset'),()=>onChange(null),false,true)}
    </View> : null}
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:8},coordinateWrap:{gap:6},group:{gap:6},answerRow:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center',justifyContent:'center'},footer:{flexDirection:'row',gap:8,flexWrap:'wrap'},row:{flexDirection:'row',gap:8,justifyContent:'center'},operations:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},
  operationButton:{flexGrow:1,flexBasis:140},largeOperation:{flexBasis:'100%'},ready:{fontSize:18,lineHeight:25,fontWeight:'700',color:Colors.text,textAlign:'center',paddingVertical:8},
  guide:{fontSize:16,lineHeight:24,color:Colors.textMuted,textAlign:'center'},note:{fontSize:14,lineHeight:21,color:Colors.textMuted,textAlign:'center'},
  button:{maxWidth:'100%',minHeight:48,padding:8,borderWidth:2,borderBottomWidth:4,borderColor:Colors.cardBorder,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:Colors.background},
  buttonText:{fontSize:17,fontWeight:'800',color:Colors.primaryDark,textAlign:'center'},small:{flexGrow:1,flexBasis:44},disabled:{opacity:0.4},
  answer:{fontSize:28,fontWeight:'900',color:Colors.text,textAlign:'center'},equation:{fontSize:26,fontWeight:'900',color:Colors.text,textAlign:'center'},
  gridLine:{position:'absolute'},axisLabel:{position:'absolute',width:28,textAlign:'center',fontSize:14,lineHeight:20,color:Colors.textMuted},axisName:{position:'absolute',fontSize:15,fontWeight:'800',color:Colors.text},
  point:{position:'absolute',width:28,height:28,marginLeft:-14,marginTop:-14,borderRadius:14,borderWidth:2,borderBottomWidth:3,borderColor:D.geometryEdge,backgroundColor:D.geometryFill,alignItems:'center',justifyContent:'center'},pointLabel:{color:Colors.text,fontSize:14,fontWeight:'900'},
});
