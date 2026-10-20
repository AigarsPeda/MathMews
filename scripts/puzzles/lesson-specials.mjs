/** Fill missing lesson specials without replacing any existing level or puzzle ID. */
import { challengeSpec } from './expanded-lessons.mjs';
import { lessonBossStory } from './lesson-boss-stories.mjs';


export function completeLessonSpecials(api) {
  const { lessons, special, text, task } = api;
  const tracks = [...new Set(lessons.map(l=>`${l.difficulty}/${l.topicId}`))];
  for (const track of tracks) {
    const entries=lessons.filter(l=>`${l.difficulty}/${l.topicId}`===track);
    const finale=entries.at(-1).levels.find(l=>l.kind==='boss');
    for (const [index,entry] of entries.entries()) {
      if (!entry.levels.some(l=>l.kind==='challenge')) {
        special(entry.id,`lesson-${index+1}-challenge`,'challenge',
          text(`${entry.title.en}: against the clock`,`${entry.title.lv}: sacensība ar laiku`),
          text('Complete the board before time runs out. You can revise your choices during the attempt.','Pabeidz laukumu, pirms beidzas laiks. Mēģinājuma laikā vari mainīt izvēles.'),
          [challengeSpec(entry.topicId,entry.difficulty,index+10,text,task)]);
      }
      if (!entry.levels.some(l=>l.kind==='boss')) {
        const {title,story}=lessonBossStory(finale.story.sceneId,index);
        special(entry.id,`lesson-${index+1}-boss`,'boss',title,
          text('A story mission with three saved stages for this lesson.','Šīs nodarbības stāsta misija ar trim saglabājamiem posmiem.'),bossTasks(entry,index,api),story);
      }
      for (const level of entry.levels) if (level.kind==='challenge') level.timeLimitSeconds={easy:180,medium:240,hard:300}[entry.difficulty];
      entry.levels.sort((a,b)=>({practice:0,challenge:1,boss:2}[a.kind]-{practice:0,challenge:1,boss:2}[b.kind]));
    }
  }
}

function bossTasks(entry,index,api) {
  const { topicId:topic,difficulty:d }=entry;
  if(topic==='patterns') {
    const step=2+index%4;
    return api.patternSet(d==='hard'
      ? [[3+index,'×',2+index%3],[31+index,'−',4+index],[(2+index%3)**4*(2+index),'÷',2+index%3],[40+index,'+',step]]
      : [[2+index,'+',step],[23+index,'−',step+1],[(step+2)*6+index,'−',step+2],[3+index,'+',step+3]]).slice(0,3);
  }
  const factories={addition:api.addSet,subtraction:api.subtractSet,numbers:api.numberSet,multiplication:api.multiplySet,division:api.divideSet,fractions:api.fractionSet,operations:api.operationSet,percentages:api.percentSet,measurement:api.measureSet,logic:api.logicSet};
  const slots=['numbers','division','logic'].includes(topic)?[0,1,2]:[0,1,3];
  const used=new Set();
  return slots.map((slot,j)=>{
    const s=index*3+j;
    let args;
    switch(topic) {
      case 'addition': args=d==='easy'?[3+index+j,4+(index+2*j)%8]:[24+index*5+j*7,17+index*3+j*5]; break;
      case 'subtraction': args=d==='easy'?[13+index*2+j,3+(index+j)%8]:[62+index*4+j*7,17+index+j*3]; break;
      case 'numbers': { const low=1+index+j*2; args=[[low+8,low,low+5,low+2]]; break; }
      case 'multiplication': args=d==='easy'?[2+(index+j)%5,3+(index+2*j)%5]:[4+(index+j)%7,5+(index+2*j)%6]; break;
      case 'division': { const people=3+(index+j)%3,each=3+(index+2*j)%4; args=[people*each+1+s%(people-1),people]; break; }
      case 'fractions': { const den=4+(index+j*2)%9,num=1+(index+2*j)%(den-2); args=[num,den,d==='hard']; break; }
      case 'operations': { const divisor=3+(index+j)%7,quotient=5+index+j*2; args=[divisor*quotient,divisor,4+index+j,d!=='hard']; break; }
      case 'percentages': args=[20*(5+index+j*3),[10,20,25,50][s%4],s%2===0]; break;
      case 'measurement': args=[7+index+j*3,4+(index+2*j)%7]; break;
      case 'logic': args=[2*(13+index*5+j*3),index%2?'subtract':'multiply']; break;
    }
    if(topic==='addition' || topic==='multiplication') {
      const key=()=>args.slice(0,2).sort((a,b)=>a-b).join(',');
      while(used.has(key())) args[1]++;
      used.add(key());
    }
    return factories[topic](...args)[slot];
  });
}
