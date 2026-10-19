import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import { NativeCatDisplay } from '@/components/pet/native/NativeCatDisplay';
import { catModelRegistry } from '@/pet-display/registry/cat-model-registry';
const playback = { kind: 'segment' as const, mood: 'idle' as const, segment: catModelRegistry.getSegment('idle') };
export default function BrandingQA() {
 const { width, height } = useWindowDimensions();
 const [ready, setReady] = useState(false);
 if(!__DEV__)return <Redirect href="/"/>;
 return <View style={{flex:1,backgroundColor:'#FFF5EB'}}><View style={{position:'absolute',left:(width-192)/2,top:(height-192)/2}}><NativeCatDisplay width={192} skinId="orange" playback={playback} playing={false} onReady={()=>setReady(true)}/></View><Text style={{position:'absolute',bottom:100}}>Native portrait {ready?'ready':'loading'}</Text></View>;
}
