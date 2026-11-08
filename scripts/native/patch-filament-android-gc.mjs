// Frame listeners can block in Filament's driver. Normal JNI transitions allow
// ART to suspend the renderer for GC while that native work is waiting.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
if (JSON.parse(readFileSync(new URL('package.json', root))).version !== '1.11.0')
  throw new Error('Review the Android frame JNI patch before upgrading Filament.');

const file = new URL('android/src/main/java/com/margelo/filament/FilamentChoreographer.java', root);
const source = readFileSync(file, 'utf8');
const marker = '// Normal JNI: frame listeners may block in the native renderer.';
if (!source.includes(marker)) {
  const before = '    @FastNative\n    private native void onFrame(long timestamp);';
  if (!source.includes(before)) throw new Error('Filament Android frame JNI patch context changed.');
  writeFileSync(file, source
    .replace('import dalvik.annotation.optimization.FastNative;\n', '')
    .replace(before, `    ${marker}\n    private native void onFrame(long timestamp);`));
}
console.log('Filament Android frame callbacks allow garbage collection during native waits.');
