/** Conservative source-level contrast audit. Pairing a fill and stroke in one SVG
 * element does not prove that the stroke crosses that fill; inspect each result. */
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const theme = fs.readFileSync(path.join(root, 'constants/puzzle-theme.ts'), 'utf8');
const palette = {};
for (const group of ['Ink', 'Quantity', 'PuzzleColors']) {
  const block = theme.match(new RegExp(`export const ${group} = \\{([\\s\\S]*?)\\n\\} as const;`))?.[1];
  if (!block) throw new Error(`Cannot read ${group} palette`);
  if (group === 'Ink' || group === 'PuzzleColors') {
    for (const [, key, hex] of block.matchAll(/(\w+):\s*['"](#[0-9a-f]{6})['"]/gi)) { palette[`${group}.${key}`] = hex; if (group === 'PuzzleColors') palette[`C.${key}`] = hex; }
  } else {
    for (const [, hue, body] of block.matchAll(/(\w+):\s*\{([^}]+)\}/g)) {
      for (const [, key, hex] of body.matchAll(/(\w+):\s*['"](#[0-9a-f]{6})['"]/gi)) palette[`Quantity.${hue}.${key}`] = hex;
    }
  }
}
palette.paper = '#ffffff';
palette['Shape.empty'] = theme.match(/export const Shape = \{[\s\S]*?\bempty: '(#[a-f0-9]+)'/i)[1];
const channel = x => (x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
const luminance = hex => { const c = hex.slice(1).match(/../g).map(v => channel(parseInt(v, 16))); return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722; };
const ratio = (a,b) => { const x = luminance(a), y = luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
// These boundaries do meet in FriendlyShapes and DiagramGlyph. Check both neighbours.
const verified = [];
function boundary(foreground, backgrounds, threshold = 3) {
  for (const background of backgrounds) {
    const contrast = ratio(palette[foreground] ?? foreground, palette[background] ?? background);
    assert.ok(contrast >= threshold, `${foreground} on ${background} has contrast ${contrast.toFixed(2)} below ${threshold}`);
    verified.push({ foreground, background, contrast: +contrast.toFixed(2), threshold });
  }
}
for (const hue of ['teal', 'violet', 'amber', 'berry']) {
  assert.notEqual(palette[`Quantity.${hue}.fill`].toLowerCase(), palette['Shape.empty'].toLowerCase(), `${hue} must differ from the empty face`);
  boundary(`Quantity.${hue}.edge`, ['paper']);
  boundary(`Quantity.${hue}.onFill`, [`Quantity.${hue}.fill`, 'Ink.guide', 'Quantity.amber.light', 'paper']);
}
boundary('Ink.soft', ['Ink.tray', 'Ink.guide', 'paper']);
boundary('PuzzleColors.primary', ['PuzzleColors.selectedSurface', 'paper']);
boundary('Ink.text', ['Ink.tray', 'Ink.guide', 'paper'], 4.5);
boundary('PuzzleColors.primaryDark', ['PuzzleColors.selectedSurface', 'paper'], 4.5);
boundary('PuzzleColors.success', ['PuzzleColors.successSurface'], 4.5);
boundary('PuzzleColors.incorrect', ['PuzzleColors.incorrectSurface'], 4.5);
const materials = fs.readFileSync(path.join(root, 'constants/puzzle-object-assets.ts'), 'utf8');
for (const [, fill, edge, light] of materials.matchAll(/fill: '(#[a-f0-9]+)', edge: '(#[a-f0-9]+)', light: '(#[a-f0-9]+)'/gi)) {
  boundary(edge, [fill, light, 'paper']);
}
const values = expr => {
  if (!expr) return [];
  const result = new Set();
  const scan = node => {
    const text = node.getText();
    if (palette[text]) result.add(text);
    if (ts.isStringLiteral(node) && /^#[0-9a-f]{6}$/i.test(node.text)) result.add(node.text.toLowerCase());
    ts.forEachChild(node, scan);
  };
  scan(expr); return [...result];
};
const color = key => palette[key] ?? key;
const results = [], uncertain = [];
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : e.name.endsWith('.tsx') ? [path.join(dir,e.name)] : []); }
for (const file of files(path.join(root, 'components/puzzle'))) {
 const source = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const visit = node => {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'Canvas') {
   const shapes = [];
   const collect = n => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
     const attrs = {};
     for (const attr of n.attributes.properties) if (ts.isJsxAttribute(attr) && attr.initializer) attrs[attr.name.getText()] = ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
     const tag = n.tagName.getText();
     const colors = values(attrs.color);
     const stroke = tag === 'Line' || attrs.strokeWidth || attrs.style?.getText().includes('stroke');
     if (colors.length) shapes.push({tag, colors, stroke:!!stroke, text:tag === 'Text' || tag.endsWith('.Text'), line:source.getLineAndCharacterOfPosition(n.getStart()).line+1});
     else if (attrs.color) uncertain.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(n.getStart()).line+1,element:tag,reason:'Skia color not resolved'});
    }
    ts.forEachChild(n,collect);
   };
   ts.forEachChild(node,collect);
   const backgrounds = shapes.filter(x => !x.stroke).flatMap(x => x.colors.filter(c => (/^Quantity\.\w+\.(fill|soft)$/.test(c) || ['PuzzleColors.card','PuzzleColors.background','C.card','C.background','#ffffff'].includes(c))).map(c => ({...x,color:c})));
   for (const shape of shapes.filter(x => x.stroke || x.text)) for (const fg of shape.colors) for (const bg of backgrounds) {
    const r = ratio(color(fg),color(bg.color)), threshold = shape.text ? 4.5 : 3;
    if (r < threshold) results.push({file:path.relative(root,file),line:shape.line,element:shape.tag,foreground:fg,background:bg.color,backgroundLine:bg.line,ratio:+r.toFixed(2),threshold,confidence:'possible: shapes share Canvas; overlap and opacity unverified'});
   }
  }
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
   const attrs = {};
   for (const attr of node.attributes.properties) if (ts.isJsxAttribute(attr) && attr.initializer) attrs[attr.name.getText()] = ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
   const name = node.tagName.getText();
   const foreground = values(attrs.stroke ?? (name === 'Text' || name.endsWith('.Text') ? attrs.fill : undefined));
   const background = values(attrs.fill).filter(x => x !== 'none');
   if (foreground.length && background.length && attrs.stroke) {
    for (const fg of foreground) for (const bg of background) {
     const r = ratio(color(fg),color(bg));
     if (r < 3) results.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,element:name,foreground:fg,background:bg,ratio:+r.toFixed(2),threshold:3,confidence:'possible: same SVG element; check stroke placement'});
    }
   } else if (attrs.stroke || ((name === 'Text' || name.endsWith('.Text')) && attrs.fill)) {
    uncertain.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,element:name,reason:'background, color expression, opacity, or rendered geometry not resolved'});
   }
  }
  ts.forEachChild(node,visit);
 };
 visit(source);
}
console.log(JSON.stringify({method:'Static candidates only. Same-element SVG fill/stroke may not meet; transparent colors, style objects, nested/overlapping shapes, inherited colors and dynamic palette lookup require rendered review. Text requires 4.5:1 but only SVG fill text can be detected here.',palette,verified,failures:results,uncertain},null,2));
