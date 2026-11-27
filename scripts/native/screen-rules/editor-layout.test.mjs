import assert from "node:assert/strict";
import test from "node:test";
import { editorLayout, sameEditorLayout } from "./editor-layout.mjs";

const question = { AXLabel: "What time is it?", frame: { x: 10.24, y: 80, width: 160, height: 30 } };
const check = { frame: { x: 12, y: 450, width: 180, height: 44 } };
const baseline = editorLayout(question, check);

test("AX key order and subpoint changes across a rounding boundary are stable", () => {
  const reordered = { ...question, frame: { height: 30.5, width: 160, y: 80, x: 10.26 } };
  assert.equal(sameEditorLayout(baseline, editorLayout(reordered, check)), true);
});

test("a changed question or movement over half a point requires another sample", () => {
  assert.equal(sameEditorLayout(baseline, editorLayout({ ...question, AXLabel: "Next question" }, check)), false);
  for (const field of Object.keys(check.frame)) {
    const moved = { frame: { ...check.frame, [field]: check.frame[field] + 0.51 } };
    assert.equal(sameEditorLayout(baseline, editorLayout(question, moved)), false);
  }
});

test("an incomplete sample breaks the pair of consecutive valid observations", () => {
  for (const missing of [undefined, { frame: {} }, { frame: { ...check.frame, y: NaN } }]) {
    const incomplete = editorLayout(question, missing);
    assert.equal(incomplete, null);
    assert.equal(sameEditorLayout(baseline, incomplete), false);
    assert.equal(sameEditorLayout(incomplete, baseline), false);
  }
});
