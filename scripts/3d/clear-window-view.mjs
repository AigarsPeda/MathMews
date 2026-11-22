// A continuous landscape across the panes, with separate lights for the sky and the cottages after dusk.
import sharp from 'sharp';

const width = 640, height = 400;
const sky = '<linearGradient id="sky" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#77b9d8"/><stop offset=".63" stop-color="#bedfdf"/><stop offset="1" stop-color="#f7ddbd"/></linearGradient>';
const far = 'M0 275 Q48 268 87 245 T166 248 Q202 241 233 222 T310 231 Q353 254 389 244 T470 226 Q522 238 551 225 T640 202 V400 H0Z';
const middle = 'M0 288 Q70 248 141 278 T271 280 Q320 263 363 274 T443 280 Q515 244 569 256 T640 247 V400 H0Z';
const near = 'M0 309 Q55 291 115 317 T252 330 Q289 324 326 325 T433 317 Q491 291 546 305 T640 287 V400 H0Z';
const houses = [[210,318,1.1],[264,321,.75],[456,298,.68]];
const trees = [[24,307,41],[58,305,31],[84,309,50],[116,316,30],[172,319,29],[191,319,21],[297,326,24],[325,327,40],[341,326,24],[412,317,23],[486,303,35],[511,306,48],[525,306,28],[580,305,42],[616,296,57]];
const meadow = 'M0 362q65-36 142-20t155 22q66-8 116-22t114-2q62 6 113-16v76H0Z';
const palettes = {
  green: ['#94b4bc','#83aaa5','#72998a','#638a7c'],
  rain: ['#8ca7ae','#729690','#537f74','#466e64'],
  snow: ['#c6d8e2','#abc5cf','#e1eaeb','#c4d8df'],
  leaves: ['#b9a59c','#c6a26e','#d6a055','#b98248'],
};
function cottage(x, y, scale, season) {
  const snowcap = season === 'snow'
    ? '<path fill="#f7faf8" d="M-16-12l12-13q7-1 17 0l12 13-5 1-4-2-5 1-5-2-9-8-10 10Z"/>'
    : '';
  const roof = season === 'rain' ? 'url(#wetRoof)' : season === 'leaves' ? '#9c6252' : '#906f6c';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path fill="#d3b99b" d="M-12 0v-12l10-9 11 9V0Z"/><path fill="#ac927e" d="M9 0v-12h12V0Z"/><path fill="${roof}" d="M-16-11l13-13h15l13 13H8L-3-20l-9 9Z"/>${snowcap}<path fill="#796b68" d="M-3 0v-7h4v7Z"/></g>`;
}
function tree(x, y, h, index, season) {
  const snowy = season === 'snow';
  // Keep some evergreens among the broadleaf trees when their crowns turn.
  const broadleaf = index % 3 === 1 || index % 5 === 0;
  let crown;
  if (broadleaf) {
    const color = season === 'leaves' ? ['#b85d36','#d17c39','#e3ad56'][index%3] : snowy ? '#809ba1' : '#719785';
    crown = `<path fill="#756f62" d="M-2 0l.6-16h2.8L2 0Z"/><path fill="${color}" d="M-3-6C-15-6-17-16-12-23c-1-8 3-14 9-14 5-7 15-1 15 6 9 7 7 18 0 21-3 3-7 4-15 4Z"/>`;
    if (snowy) crown += '<path fill="#ecf3f2" d="M-13-22q-1-14 10-16 11-9 16 8l-3 5-4-2-3 3-4-4-4 3-4-1Z"/>';
  } else {
    crown = `<path fill="${snowy?'#62838a':'#5e877f'}" d="M0-40L7-24 4-25 11-15 6-17 15-4 2-6 2 0H-2V-6L-13-4-6-17-10-15-4-26-7-24Z"/>`;
    if (snowy) crown += '<path fill="#f1f6f4" d="M0-40l6 14-5-3-5 2ZM-4-24l4 2 4-3 6 9-8-3-8 2ZM-6-16l6 3 5-3 8 10-11-4-12 3Z"/>';
  }
  return `<g transform="translate(${x} ${y}) scale(${h/40})">${crown}</g>`;
}
// A band of sky reflected across the pitched roof. Water on the ground
// reflects the darker bank at its far edge and breaks into short highlights.
const rainPaint = `<defs>
  <linearGradient id="wetRoof" x1=".15" y1="0" x2=".65" y2="1">
    <stop stop-color="#655956"/><stop offset=".31" stop-color="#766c69"/><stop offset=".51" stop-color="#c5d6d8"/>
    <stop offset=".68" stop-color="#869895"/><stop offset="1" stop-color="#5c5251"/>
  </linearGradient>
  <linearGradient id="water" x2="0" y2="1">
    <stop stop-color="#577775"/><stop offset=".43" stop-color="#829fa3"/><stop offset="1" stop-color="#b6cdcc"/>
  </linearGradient>
</defs>`;
function puddle(x, y, width, depth) {
  return `<g transform="translate(${x} ${y}) scale(${width/50} ${depth/12})">
    <path fill="url(#water)" d="M-25 1q3-3 11-3l6-2q7-3 16 0l7 1q10 0 10 3-2 3-11 3l-6 2q-9 2-18-1-13 1-15-3Z"/>
    <path fill="#d3e0dd" d="M-16 1q6-2 15-1-3 2-12 2ZM5 3q4-2 10-2-3 2-10 2Z"/>
  </g>`;
}
function terrain(season) {
  const [ridge, woods, pasture, field] = palettes[season];
  const wet = season === 'rain';
  return `${wet ? rainPaint : ''}<path d="${far}" fill="${ridge}"/><path d="${middle}" fill="${woods}"/>
    ${houses.map(([x,y,s])=>cottage(x,y,s,season)).join('')}${trees.map(([x,y,h],i)=>tree(x,y,h,i,season)).join('')}
    <path d="${near}" fill="${pasture}"/><path d="${meadow}" fill="${field}"/>
    ${wet ? puddle(210,337,49,11) + puddle(279,330,27,7) + puddle(450,316,41,9) : ''}`;
}
const landscape = `<defs>${sky}</defs><rect width="640" height="400" fill="url(#sky)"/>
  <path fill="#f6f1dd" opacity=".78" d="M47 118q11-9 27-8 9-15 26-12 12-10 29-3 9 4 12 13 19-2 32 9-63 4-126 1ZM335 158q12-8 24-6 9-12 23-10 11 0 18 9 14-1 22 6-36 4-87 1Z"/>
  ${terrain('green')}`;
const stars = [[40,69,1.5],[78,45,2],[123,154,1.7],[144,78,2],[178,48,1.6],[204,105,3],[231,64,1.3],[267,86,1.8],[279,153,2.4],[308,49,2.6],[326,122,1.5],[353,81,2],[370,38,1.3],[389,142,1.8],[453,64,1.8],[472,123,2.5],[499,36,1.7],[527,80,2.1],[551,156,1.6],[585,55,2.4],[616,101,1.7]];
const moon = '<path fill="#ffe6b2" d="M422 70a22 22 0 1 0 16 34c-12 4-23-2-26-12-3-9 1-17 10-22Z"/>';
const lamps = houses.map(([x,y,s]) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#ffd794"><rect x="-8" y="-10" width="3.3" height="4"/><rect x="12" y="-9" width="4.4" height="4.4"/></g>`).join('');
function star(x, y, radius) {
  if (radius < 2.3) return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#d5e2ee"/>`;
  return `<path transform="translate(${x} ${y}) scale(${radius})" fill="#f8ecd6" d="M0 -1.4Q.1 -.15 1 0Q.1 .15 0 1.4Q-.1 .15 -1 0Q-.1 -.15 0 -1.4Z"/>`;
}
const nightLights = `<defs><radialGradient id="halo"><stop stop-color="#ffdb9c" stop-opacity=".22"/><stop offset="1" stop-color="#ffdb9c" stop-opacity="0"/></radialGradient></defs>
  <circle cx="418" cy="92" r="45" fill="url(#halo)"/>${moon}${stars.map(([x,y,r])=>star(x,y,r)).join('')}`;

function raster(body) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`));
}
const png = { palette: true, colours: 192, dither: 0 };

async function seasonalTerrain(season) {
  const pixels = await raster(terrain(season)).ensureAlpha().raw().toBuffer();
  // Vary coverage over the slope so patches spread and recede as weather strength changes.
  // The alpha mask also keeps these surfaces behind transparent flakes and leaves.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = (y * width + x) * 4 + 3;
    if (!pixels[alpha]) continue;
    const slope = (height-y)/height;
    const patches = .12*Math.sin(x*.041+y*.095) + .09*Math.sin(x*.10-y*.16);
    const coverage = Math.round(12 * (.55 + .35*slope + patches)) / 12;
    pixels[alpha] = Math.round(pixels[alpha] * coverage);
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png(png).toBuffer();
}

export async function clearWindowTextures() {
  return Promise.all([raster(landscape).png(png).toBuffer(), seasonalTerrain('rain'), seasonalTerrain('snow'), seasonalTerrain('leaves'),
    raster(nightLights).png(png).toBuffer(), raster(lamps).png(png).toBuffer()]);
}
