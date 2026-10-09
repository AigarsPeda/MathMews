import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageRoot = new URL('../../node_modules/react-native-filament/', import.meta.url);
const version = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')).version;
if (version !== '1.11.0') throw new Error(`Review Filament recovery patches before upgrading ${version}`);
// Keep the exact sources in the repo so reinstalling dependencies preserves recovery.
for (const file of ['hooks/useDisposableResource.ts', 'hooks/useBuffer.ts', 'hooks/useModel.ts', 'hooks/useWorkletEffect.ts', 'react/FilamentView.tsx']) {
  const source = readFileSync(new URL(`filament-recovery/${file.split('/').at(-1)}.txt`, import.meta.url), 'utf8');
  writeFileSync(fileURLToPath(new URL(`src/${file}`, packageRoot)), source);
}
console.log('Filament resource cancellation and scene error recovery ready.');
