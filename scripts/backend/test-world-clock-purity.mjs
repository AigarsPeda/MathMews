import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ESLint } from 'eslint';

test('world clock hook obeys React render purity without compiler opt-outs', async () => {
  const filePath = 'hooks/use-world-clock-now.ts';
  const source = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(source, /use no memo|eslint-disable/);
  const eslint = new ESLint({ overrideConfig: { rules: { 'react-hooks/purity': 'error' } } });
  const results = await eslint.lintText(source, { filePath });
  const errors = results.flatMap(result => result.messages.filter(message => message.severity === 2));
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
});
