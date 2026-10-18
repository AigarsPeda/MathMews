/** Offline conservative solid decomposition. Runtime only needs convex vertical prisms. */
export const bounds = points => ({min:[0,1,2].map(k=>points.reduce((v,p)=>Math.min(v,p[k]),Infinity)),
  max:[0,1,2].map(k=>points.reduce((v,p)=>Math.max(v,p[k]),-Infinity))});
export function hull(points) {
  const sorted = [...new Map(points.map(p=>[[p[0],p[2]].join(','),[p[0],p[2]]])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const half = list => {const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
const subtract = (a,b) => a.map((v,k)=>v-b[k]);
const dot = (a,b) => a.reduce((v,p,k)=>v+p*b[k],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const prism = points => ({...bounds(points),footprint:hull(points)});
function clip(polygon, axis, cut, side) {
  const out=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const insideA=(a[axis]-cut)*side>=0,insideB=(b[axis]-cut)*side>=0;
    if(insideA)out.push(a);
    if(insideA!==insideB) {
      const t=(cut-a[axis])/(b[axis]-a[axis]);
      out.push(a.map((v,k)=>k===axis?cut:v+(b[k]-v)*t));
    }
  }
  return out;
}
function convex(mesh) {
  const points=[...new Map(mesh.points.map(p=>[p.map(v=>v.toFixed(6)).join(':'),p])).values()];
  for(const [a,b,c]of mesh.triangles) {
    const normal=cross(subtract(b,a),subtract(c,a)),length=Math.hypot(...normal);
    if(length<1e-10)continue;
    let positive=false,negative=false;
    for(const p of points) {
      const d=dot(normal,subtract(p,a))/length;
      positive ||= d>.001; negative ||= d< -.001;
      if(positive&&negative)return false;
    }
  }
  return true;
}
function closed(mesh) {
  const edges=new Map(), key=p=>p.map(v=>Math.round(v*1e5)).join(':');
  for(const triangle of mesh.triangles)for(let i=0;i<3;i++) {
    const a=key(triangle[i]),b=key(triangle[(i+1)%3]);
    if(a===b)continue;
    const edge=[a,b].sort().join('/');edges.set(edge,(edges.get(edge)??0)+1);
  }
  return [...edges.values()].every(count=>count===2);
}
function inside(point, triangles) {
  const direction=[1,.3713907,.1371173], hits=[];
  for(const [a,b,c]of triangles) {
    const e1=subtract(b,a),e2=subtract(c,a),h=cross(direction,e2),det=dot(e1,h);
    if(Math.abs(det)<1e-10)continue;
    const s=subtract(point,a),u=dot(s,h)/det;
    if(u< -1e-8||u>1+1e-8)continue;
    const q=cross(s,e1),v=dot(direction,q)/det;
    if(v< -1e-8||u+v>1+1e-8)continue;
    const distance=dot(e2,q)/det;
    if(distance>1e-8)hits.push(distance);
  }
  hits.sort((a,b)=>a-b);
  return hits.filter((v,i)=>i===0||v-hits[i-1]>1e-6).length%2===1;
}
/** Convex parts retain solid interiors. Height bands follow tapered or slanted
 * parts instead of filling the air beside a chair leg or below a lampshade. */
function convexPrisms(mesh) {
  const whole=prism(mesh.points),height=whole.max[1]-whole.min[1];
  if(height<=.1)return [whole];
  const count=Math.ceil(height/.1), bands=[];
  for(let i=0;i<count;i++) {
    const low=whole.min[1]+height*i/count,high=whole.min[1]+height*(i+1)/count;
    const points=mesh.triangles.flatMap(t=>clip(clip(t,1,low,1),1,high,-1));
    if(points.length)bands.push(prism(points));
  }
  // Straight extrusions and almost-flat bevels need only one prism. Compare
  // support distances on every band edge, including asymmetric footprints.
  const unchanged=bands.every(b=>b.footprint.every((p,i,poly)=>{
    const q=poly[(i+1)%poly.length],nx=q[1]-p[1],nz=p[0]-q[0],length=Math.hypot(nx,nz);
    return whole.footprint.every(v=>(nx*(v[0]-p[0])+nz*(v[1]-p[1]))/length<=.015);
  }));
  return unchanged?[whole]:bands;
}
/** Concave parts are clipped into small spatial cells, so a U-shaped back or
 * curved runner keeps its hole. Interior corners fill closed solids as well as
 * their surface; a small object cannot disappear inside a hollow collider shell. */
export function placementPrisms(mesh) {
  if(convex(mesh))return convexPrisms(mesh).filter(b=>b.footprint.length>=3);
  const solid=closed(mesh), cache=new Map();
  const contains=p=>{
    const key=p.map(v=>v.toFixed(7)).join(':');
    if(!cache.has(key))cache.set(key,solid&&inside(p,mesh.triangles));
    return cache.get(key);
  };
  const out=[];
  function visit(polygons,region) {
    if(!polygons.length) {
      if(contains(region.min.map((v,k)=>(v+region.max[k])/2)))out.push(prism([
        ...[region.min[1],region.max[1]].flatMap(y=>[region.min[0],region.max[0]].flatMap(x=>[region.min[2],region.max[2]].map(z=>[x,y,z]))),
      ]));
      return;
    }
    const span=region.min.map((v,k)=>region.max[k]-v),axis=span.indexOf(Math.max(...span));
    if(span[axis]>.12) {
      const cut=(region.min[axis]+region.max[axis])/2;
      for(const side of [-1,1]) {
        const next={min:[...region.min],max:[...region.max]};
        next[side<0?'max':'min'][axis]=cut;
        visit(polygons.map(p=>clip(p,axis,cut,side)).filter(p=>p.length>=3),next);
      }
      return;
    }
    const points=polygons.flat();
    for(const x of [region.min[0],region.max[0]])for(const y of [region.min[1],region.max[1]])for(const z of [region.min[2],region.max[2]]) {
      const p=[x,y,z];if(contains(p))points.push(p);
    }
    const box=prism(points);
    if(box.footprint.length>=3)out.push(box);
  }
  visit(mesh.triangles,bounds(mesh.points));
  return mergeCellPrisms(out,bounds(mesh.points));
}

const area = poly => Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
const rectangular = box => Math.abs(area(box.footprint)-(box.max[0]-box.min[0])*(box.max[2]-box.min[2]))<1e-8;
/** Coalesce occupied rectangular cells. This keeps hollow parts hollow without
 * shipping thousands of tiny boxes for their solid walls and floor. */
export function compactPrisms(input) {
  let rectangles=input.filter(rectangular);
  const others=input.filter(box=>!rectangular(box));
  for(let pass=0;pass<3;pass++)for(const axis of [0,2,1]) {
    const groups=new Map();
    for(const box of rectangles) {
      const key=[0,1,2].filter(k=>k!==axis).flatMap(k=>[box.min[k],box.max[k]]).map(v=>v.toFixed(6)).join(':');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(box);
    }
    rectangles=[];
    for(const group of groups.values()) {
      group.sort((a,b)=>a.min[axis]-b.min[axis]);
      let current;
      for(const box of group) {
        if(current&&box.min[axis]<=current.max[axis]+1e-7)current.max[axis]=Math.max(current.max[axis],box.max[axis]);
        else {current={min:[...box.min],max:[...box.max]};rectangles.push(current);}
      }
    }
  }
  // Larger prisms also cover trim, buttons and seams embedded in furniture.
  const all=[...rectangles,...others].sort((a,b)=>
    b.min.reduce((v,p,k)=>v*(b.max[k]-p),1)-a.min.reduce((v,p,k)=>v*(a.max[k]-p),1));
  const out=[];
  for(const box of all) {
    const polygon=box.footprint??[[box.min[0],box.min[2]],[box.max[0],box.min[2]],[box.max[0],box.max[2]],[box.min[0],box.max[2]]];
    if(out.some(other=>[0,1,2].every(k=>box.min[k]>=other.min[k]-1e-7&&box.max[k]<=other.max[k]+1e-7)
      && (!other.footprint||polygon.every(p=>other.footprint.every((a,i,poly)=>{
        const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-8;
      })))))continue;
    out.push(box);
  }
  return out;
}


/** Merge neighboring cells with only a small increase in covered area.
 * Small vertical rounding lets the
 * same curved wall share a prism without bridging its open center. */
function mergeCellPrisms(boxes,limits) {
  const groups=new Map();
  for(const box of boxes) {
    const low=Math.max(limits.min[1],Math.floor((box.min[1]+1e-7)/.02)*.02),high=Math.min(limits.max[1],Math.ceil((box.max[1]-1e-7)/.02)*.02);
    const key=[low,high].map(v=>v.toFixed(5)).join(':');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({...box,min:[box.min[0],low,box.min[2]],max:[box.max[0],high,box.max[2]]});
  }
  const result=[];
  for(const group of groups.values()) {
    for(let i=0;i<group.length;i++) {
      let a=group[i];
      if(!a)continue;
      for(let j=i+1;j<group.length;j++) {
        const b=group[j];if(!b)continue;
        const axis=[0,2].find(k=>Math.abs(a.max[k]-b.min[k])<1e-6||Math.abs(b.max[k]-a.min[k])<1e-6);
        if(axis===undefined)continue;
        const other=2-axis,edge=Math.min(a.max[other],b.max[other])-Math.max(a.min[other],b.min[other]);
        if(edge<=0)continue;
        const footprint=hull([...a.footprint,...b.footprint].map(([x,z])=>[x,0,z]));
        if(area(footprint)-area(a.footprint)-area(b.footprint)>.005*edge+1e-9)continue;
        a={min:a.min.map((v,k)=>Math.min(v,b.min[k])),max:a.max.map((v,k)=>Math.max(v,b.max[k])),footprint};
        group[j]=undefined;group[i]=a;j=i;
      }
      result.push(a);
    }
  }
  return result;
}
