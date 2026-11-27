#!/usr/bin/env node
/**
 * Static check for the friendly puzzle style rules (docs/PUZZLE_STYLE_GUIDE.md).
 * It flags outlines, hairlines and dashed borders in puzzle components so builders don't need a simulator run to find them.
 *
 *   node scripts/puzzles/lint-friendly.mjs                 # all of components/puzzle
 *   node scripts/puzzles/lint-friendly.mjs path/to/File.tsx ...
 *   node scripts/puzzles/lint-friendly.mjs --changed       # only files changed against HEAD
 *
 * Allowed exceptions (answer cards, keypad keys, the verdict chip, replay, an active drop target, clock hands, a number-line rail, hop arcs)
 * need a `friendly-ok: <reason>` comment on the same line or the line above. Exits 1 when anything unexplained remains.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const RULES = [
  { id: "border", re: /\bborder(Top|Left|Right)?Width\s*[:=]\s*\{?\s*(?!0\b)[\w.(]/, why: "outline on a piece. Use a fill, a 4 pt gap and a 3 pt bottom lip (borderBottomWidth alone is fine)" },
  { id: "hairline", re: /hairlineWidth/, why: "hairline. Fine lines are banned" },
  { id: "dashed", re: /borderStyle\s*:\s*['"](dashed|dotted)['"]|strokeDasharray|DashPathEffect|<DashPathEffect/, why: "dashed outline. Allowed only on an active drop target" },
  { id: "thin-bar", re: /\b(height|width|borderBottomWidth)\s*:\s*(0\.\d+|[1-2](\.\d+)?)\s*[,}]/, why: "1–2 pt bar or seam reads as a hairline. Use a 4 pt gap, a soft band of 10 pt or more, or nothing" },
  { id: "no-svg", re: /from\s+['"]react-native-svg['"]/, why: "react-native-svg is not installed and breaks the bundle for everyone. Use @shopify/react-native-skia (Canvas and Path) or View fills" },
  { id: "stroke", re: /style\s*=\s*["']stroke["']|PaintStyle\.Stroke|\bstrokeWidth\s*[:=]\s*\{?\s*(?!0\b)[\w.(]/, why: "stroked shape. Glyphs and pieces must be fill-only" },
];

const args = process.argv.slice(2);
let files;
if (args.includes("--changed")) {
  files = execSync("git diff --name-only HEAD -- components/puzzle app/play.tsx", { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(f => /\.tsx?$/.test(f)).map(f => join(ROOT, f));
} else if (args.length) {
  files = args.map(f => (f.startsWith("/") ? f : join(process.cwd(), f)));
} else {
  const walk = d => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
  files = walk(join(ROOT, "components/puzzle"));
}

let total = 0;
const perFile = [];
for (const file of files) {
  let lines;
  try { lines = readFileSync(file, "utf8").split("\n"); } catch { continue; }
  const hits = [];
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    const excused = /friendly-ok/.test(line) || /friendly-ok/.test(lines[i - 1] ?? "");
    for (const r of RULES) if (r.re.test(line) && !excused) hits.push(`  ${i + 1}: [${r.id}] ${r.why}\n      ${line.trim().slice(0, 140)}`);
  });
  if (hits.length) { perFile.push(`${relative(ROOT, file)} (${hits.length})\n${hits.join("\n")}`); total += hits.length; }
}
console.log(perFile.join("\n\n") || "No outline, hairline or dashed-border findings.");
console.log(`\nlint-friendly: ${total} finding(s) in ${perFile.length} of ${files.length} file(s)`);
process.exit(total ? 1 : 0);
