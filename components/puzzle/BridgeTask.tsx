/** Local puzzle extension: mathematical diagrams, Berry controls, shared Check.
 * Guided models fade into independent work; reset never submits or spends a life.
 */
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { NumberLineTrack } from '@/components/puzzle/NumberLineTrack';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { equationText, transformEquation, type BridgePuzzle, type BridgeState, type Point } from '@/utils/bridge-models';
import { appendGeometryDigit } from '@/utils/geometry-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: BridgePuzzle; value: BridgeState | null; onChange: (value: BridgeState | null) => void; answered: boolean };
export function BridgeTask({ puzzle, value, onChange, answered }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(280);
  const button = (id: string, label: string, action: () => void, disabled = false, small = false, wide = false) =>
    <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: answered || disabled }}
      disabled={answered || disabled} onPress={action} style={[styles.button, small && styles.small, wide && styles.wide, (answered || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const numeric = () => <View style={styles.group}>
    <Text style={styles.note}>{t('bridge.answer')}</Text><Text testID="bridge-value" style={styles.answer}>{value?.value ?? '?'}</Text>
    {[['1','2','3','4','5'],['6','7','8','9','0']].map((row,i)=><View key={i} style={styles.row}>{row.map(d=>button(`bridge-digit-${d}`,d,()=>onChange({value:appendGeometryDigit(value?.value??null,Number(d))}),false,true))}</View>)}
    {button('bridge-erase',t('geometryModels.erase'),()=>onChange({value:value?.value!=null && value.value>=10 ? Math.floor(value.value/10) : null}))}
  </View>;
  let model;
  if(puzzle.type==='ratio_table') {
    const {a,b,targetA,guided}=puzzle.payload;
    const scale=Math.max(a,targetA);
    model=<>
      <View style={styles.table}>
        <View style={styles.row}><Text style={styles.cell}>{t('bridge.groups')}</Text><Text style={styles.cell}>{t('bridge.items')}</Text></View>
        {[[a,b],[targetA,value?.value??'?']].map((pair,i)=><View key={i} style={styles.row}>{pair.map((n,j)=><Text key={j} style={[styles.cell,i===1&&j===1&&styles.unknown]}>{n}</Text>)}</View>)}
      </View>
      {guided && puzzle.difficulty==='easy' ? <View style={styles.row}>{Array.from({length:targetA},(_,i)=><View key={i} style={styles.dotGroup}>{Array.from({length:b/a},(_,j)=><View key={j} style={styles.dot}/>)}</View>)}</View> : null}
      <View accessible accessibilityLabel={t('bridge.linkedLines')} style={styles.group}>
        <Text style={styles.note}>{t('bridge.linkedLines')}</Text>
        {[0,1].map(row=><View key={row} style={styles.linkedLine}>{[...new Set([0,a,targetA])].sort((x,y)=>x-y).map(top=><View key={top} style={[styles.linkedTick,{left:`${top/scale*100}%`}]}><Text style={styles.tick}>{row===0?top:top===0?'0':top===a?b:'?'}</Text></View>)}</View>)}
      </View>
      {numeric()}
    </>;
  } else if(puzzle.type==='signed_line') {
    const {min,max,start,mode,delta}=puzzle.payload;
    const current=value?.value??0;
    model=<>
      <Text style={styles.equation}>{mode==='place'?String(start):`${start} ${delta<0?'−':'+'} ${Math.abs(delta)} = ?`}</Text>
      <NumberLineTrack min={min} max={max} start={mode==='place'?0:start} value={current} onSelect={n=>onChange({value:n})} disabled={answered}/>
      <Text testID="bridge-value" style={styles.answer}>{value?.value??'?'}</Text>
      <View style={styles.row}>{[-1,1].map(d=>button(`bridge-step-${d}`,t(d<0?'puzzleTypes.numberLineMoveLeft':'puzzleTypes.numberLineMoveRight'),()=>onChange({value:current+d}),current+d<min||current+d>max,true))}</View>
      {button('bridge-zero',t('bridge.selectZero'),()=>onChange({value:0}))}
    </>;
  } else if(puzzle.type==='equation_board') {
    const {a,b,c}=puzzle.payload, equation=value?.equation??{a,b,c};
    const operations: ['add'|'divide',number][]=[['add',-1],['add',1],...(puzzle.difficulty==='easy'?[]:[['add',-5],['add',5],['divide',2],['divide',3],['divide',4]] as ['add'|'divide',number][])];
    model=<>
      <Text style={styles.note}>{t('bridge.original')}</Text><Text style={styles.original}>{equationText({a,b,c})}</Text>
      <View style={styles.balance}>
        {puzzle.difficulty==='easy'?<View style={styles.pans}>
          <View style={styles.pan}><Text style={styles.xTile}>x</Text>{Array.from({length:Math.max(0,equation.b)},(_,i)=><View key={i} style={styles.dot}/>)}</View>
          <Text style={styles.original}>=</Text><View style={styles.pan}>{Array.from({length:Math.max(0,equation.c)},(_,i)=><View key={i} style={styles.dot}/>)}</View>
        </View>:null}
        <Text testID="bridge-equation" style={styles.equation}>{equationText(equation)}</Text><View style={styles.beam}/><View style={styles.fulcrum}/></View>
      <Text style={styles.note}>{t('bridge.bothSides')}</Text>
      <View style={styles.operations}>{operations.map(([op,n])=>{const candidate=transformEquation(equation,op,n);const next=puzzle.difficulty==='easy'&&candidate&&(candidate.b<0||candidate.c<0||candidate.c>20)?null:candidate;return button(`bridge-${op}-${n}`,`${op==='divide'?'÷':n<0?'−':'+'} ${Math.abs(n)}`,()=>onChange({equation:next}),!next,true,true);})}</View>
      {puzzle.difficulty!=='easy'?<Text style={styles.note}>{t('bridge.divideWhole')}</Text>:null}
    </>;
  } else {
    const {min,max,mode,start,end}=puzzle.payload, size=Math.min(32,(width-36)/(max-min)), side=(max-min)*size;
    const point=value?.point??{x:0,y:0};
    const position=(p:Point)=>({left:(p.x-min)*size,top:(max-p.y)*size});
    const marker=(p:Point,label:string)=> <View key={label} pointerEvents="none" style={[styles.point,position(p)]}><Text style={styles.pointLabel}>{label}</Text></View>;
    model=<>
      <Text style={styles.equation}>{mode==='plot'?`(${end.x}, ${end.y})`:mode==='translate'?`A (${start.x}, ${start.y})`:`A (${start.x}, ${start.y}) · B (${end.x}, ${end.y})`}</Text>
      {mode==='translate'?<Text style={styles.note}>{t('bridge.moveBy',{x:end.x>=0?`+${end.x}`:end.x,y:end.y>=0?`+${end.y}`:end.y})}</Text>:null}
      <View testID="bridge-grid" style={{width:side+36,height:side+36,alignSelf:'center',padding:18}}>
        <View style={{width:side,height:side}}>
          {Array.from({length:max-min+1},(_,i)=>{const n=min+i;return <View key={n} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.gridLine,{left:i*size,top:0,width:n===0?2:1,height:side,backgroundColor:n===0?Colors.text:Colors.cardBorder}]}/>
            <View style={[styles.gridLine,{left:0,top:(max-n)*size,width:side,height:n===0?2:1,backgroundColor:n===0?Colors.text:Colors.cardBorder}]}/>
            <Text style={[styles.axisLabel,{left:i*size-10,top:side+3}]}>{n}</Text><Text style={[styles.axisLabel,{left:-23,top:(max-n)*size-9}]}>{n}</Text>
          </View>;})}
          <Text style={[styles.axisName,{right:-17,top:max*size-10}]}>x</Text><Text style={[styles.axisName,{left:-min*size-5,top:-22}]}>y</Text>
          {mode!=='plot'?marker(start,'A'):null}{mode==='distance'?marker(end,'B'):null}
          {mode!=='distance'&&value?.point?marker(point,'●'):null}
          {mode!=='distance'?<Pressable testID="bridge-plot" accessible={false} disabled={answered} style={StyleSheet.absoluteFill} onPress={e=>{const x=Math.round(e.nativeEvent.locationX/size)+min,y=max-Math.round(e.nativeEvent.locationY/size);onChange({point:{x:Math.min(max,Math.max(min,x)),y:Math.min(max,Math.max(min,y))}});}}/>:null}
        </View>
      </View>
      {mode==='distance'?numeric():<View style={styles.group}>
        <Text testID="bridge-point" style={styles.answer}>{value?.point?`(${point.x}, ${point.y})`:'(?, ?)'}</Text>
        <View style={styles.operations}>{(['x','y'] as const).flatMap(axis=>[-1,1].map(d=>button(`bridge-${axis}-${d}`,`${axis} ${d>0?'+':'−'} 1`,()=>onChange({point:{...point,[axis]:point[axis]+d}}),point[axis]+d<min||point[axis]+d>max,true)))}</View>
        {button('bridge-origin',t('bridge.selectOrigin'),()=>onChange({point:{x:0,y:0}}))}
      </View>}
    </>;
  }
  return <View style={styles.wrap} onLayout={e=>setWidth(e.nativeEvent.layout.width)}>
    {puzzle.payload.guided?<Text style={styles.guide}>{t(`bridge.guide_${puzzle.type}`)}</Text>:null}
    {model}
    {button('bridge-reset',t('geometryModels.reset'),()=>onChange(null))}
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:18},group:{gap:10},row:{flexDirection:'row',gap:8,justifyContent:'center'},operations:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},
  guide:{fontSize:16,lineHeight:24,color:Colors.textMuted,textAlign:'center'},note:{fontSize:14,lineHeight:21,color:Colors.textMuted,textAlign:'center'},
  button:{minHeight:48,padding:12,borderWidth:1,borderColor:Colors.cardBorder,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:Colors.background},
  buttonText:{fontSize:17,fontWeight:'800',color:Colors.primaryDark,textAlign:'center'},small:{flexGrow:1,flexBasis:44},wide:{flexBasis:72,minWidth:72},disabled:{opacity:0.4},
  answer:{fontSize:28,fontWeight:'900',color:Colors.text,textAlign:'center'},equation:{fontSize:26,fontWeight:'900',color:Colors.text,textAlign:'center'},original:{fontSize:18,color:Colors.textMuted,textAlign:'center'},
  table:{borderTopWidth:2,borderBottomWidth:2,borderColor:Colors.text,paddingVertical:8,gap:8},cell:{flex:1,textAlign:'center',fontSize:20,lineHeight:28,color:Colors.text,fontWeight:'700'},unknown:{color:Colors.primaryDark},
  linkedLine:{height:40,marginHorizontal:20,borderBottomWidth:2,borderColor:Colors.text},linkedTick:{position:'absolute',bottom:0,width:36,marginLeft:-18,borderBottomWidth:5,borderColor:Colors.primary,paddingBottom:8},tick:{textAlign:'center',fontSize:16,color:Colors.text},
  dotGroup:{padding:8,borderWidth:1,borderColor:Colors.cardBorder,gap:4,flexDirection:'row',flexWrap:'wrap',maxWidth:70},dot:{width:10,height:10,borderRadius:5,backgroundColor:Colors.primary},
  pans:{flexDirection:'row',alignItems:'center',gap:12},pan:{flex:1,minHeight:60,flexDirection:'row',flexWrap:'wrap',gap:6,alignItems:'center',justifyContent:'center',padding:8,borderBottomWidth:2,borderColor:Colors.text},xTile:{fontSize:22,fontWeight:'900',color:Colors.primaryDark,padding:4},
  balance:{gap:10,alignItems:'center',paddingVertical:12},beam:{height:3,width:'90%',backgroundColor:Colors.text},fulcrum:{height:16,width:5,backgroundColor:Colors.text},
  gridLine:{position:'absolute'},axisLabel:{position:'absolute',width:20,textAlign:'center',fontSize:12,color:Colors.textMuted},axisName:{position:'absolute',fontSize:15,fontWeight:'800',color:Colors.text},
  point:{position:'absolute',width:24,height:24,marginLeft:-12,marginTop:-12,borderRadius:12,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center'},pointLabel:{color:Colors.background,fontSize:14,fontWeight:'900'},
});
