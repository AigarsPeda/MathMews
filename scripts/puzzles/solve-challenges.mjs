/** Independent exhaustive answers for content checks, never imported by the app. */
export function challengeAnswers(puzzle) {
  const p=puzzle.payload;
  if(puzzle.type==='sort_buckets') return [{kind:'sort',buckets:p.rule==='range'
    ? p.numbers.map(n=>n<p.boundary?0:1)
    : p.fractions.map(([n,d])=>p.targets.findIndex(([a,b])=>n*b===a*d))}];
  if(puzzle.type==='repair_pattern') return [{kind:'sequence',values:p.solution}];
  if(puzzle.type==='budget_plan') {
    const answers=[];
    for(let mask=0;mask<2**p.items.length;mask++) {
      const indices=p.items.flatMap((_,i)=>mask&(1<<i)?[i]:[]);
      const spent=indices.reduce((sum,i)=>sum+p.items[i].price-p.items[i].price*p.items[i].discountPercent/100,0);
      if(indices.length===p.pickCount && Math.abs(p.budget-spent-p.remaining)<1e-6) answers.push({kind:'budget',indices});
    }
    return answers;
  }
  if(puzzle.type==='route_grid') {
    const answers=[];
    function search(path,value) {
      const current=path.at(-1);
      if(path.length===p.moves+1) {
        if(current===p.cells.length-1 && value===p.target) answers.push({kind:'route',cells:path});
        return;
      }
      for(let next=1;next<p.cells.length;next++) {
        if(path.includes(next)) continue;
        const rowA=Math.floor(current/p.columns),colA=current%p.columns,rowB=Math.floor(next/p.columns),colB=next%p.columns;
        if(Math.abs(rowA-rowB)+Math.abs(colA-colB)!==1) continue;
        const cell=p.cells[next];
        const v=cell.operator==='+'?value+cell.operand:cell.operator==='-'?value-cell.operand:cell.operator==='×'?value*cell.operand:value/cell.operand;
        if(Number.isInteger(v) && v>=0) search([...path,next],v);
      }
    }
    search([0],p.start);
    return answers;
  }
  return null;
}
