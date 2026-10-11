// Bounded shared asset bytes and incremental gltfio resource loading on both OSes.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
if (JSON.parse(readFileSync(new URL('package.json', root))).version !== '1.11.0')
  throw new Error('Review the performance bindings before upgrading Filament.');
function patch(path, marker, before, after) {
  const url = new URL(path, root), source = readFileSync(url, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Filament performance patch context changed: ' + path);
  writeFileSync(url, source.replace(before, after));
}
// Unconditional NSLog bypasses RNF_ENABLE_LOGS and can block both the main
// and JS threads when a simulator's stderr pipe stops draining. Keep failures.
for (const [path, messages] of [
  ['ios/src/RNFFilamentComponent.mm', ['[RNF/FilamentComponent] initWithFrame', '[RNF/FilamentComponent] setupOnViewReady', '[RNF/FilamentComponent] updateProps']],
  ['ios/src/RNFAppleChoreographer.mm', ['Invalidating choreographer', 'Stopping choreographer', 'Starting choreographer']],
]) for (const message of messages) {
  const marker = '// Math Mews: quiet lifecycle log ' + message;
  patch(path, marker, `NSLog(@"${message}");`, marker);
}
for (const file of ['AssetBufferCache', 'loadModelResources', 'PreparedModels'])
  writeFileSync(new URL(`src/utilities/${file}.ts`, root), readFileSync(new URL(`filament-recovery/${file}.ts.txt`, import.meta.url)));
patch('cpp/RNFFilamentBuffer.h', 'FilamentBuffer::clone',
  '  void loadHybridMethods() override {}', `  void loadHybridMethods() override {
    registerHybridMethod("clone", &FilamentBuffer::clone, this);
    registerHybridGetter("byteLength", &FilamentBuffer::getByteLength, this);
  }
  std::shared_ptr<FilamentBuffer> clone() { return std::make_shared<FilamentBuffer>(pointee()); }
  double getByteLength() { return static_cast<double>(pointee()->getSize()); }`);
for (const path of ['src/native/FilamentBuffer.ts', 'lib/typescript/native/FilamentBuffer.d.ts'])
  patch(path, 'clone(): FilamentBuffer', 'export interface FilamentBuffer extends PointerHolder {',
    'export interface FilamentBuffer extends PointerHolder { readonly byteLength: number; clone(): FilamentBuffer;');
patch('cpp/core/RNFEngineImpl.h', 'beginLoadAsset(',
  '  std::shared_ptr<LightManagerWrapper> createLightManager();', `  std::shared_ptr<FilamentAssetWrapper> beginLoadAsset(std::shared_ptr<FilamentBuffer> buffer, int instanceCount);
  double updateAssetLoad();
  void cancelAssetLoad();
  std::shared_ptr<LightManagerWrapper> createLightManager();`);
patch('cpp/core/RNFEngineImpl.h', 'bool loadResources = true',
  'makeAssetWrapper(FilamentAsset* assetPtr);', 'makeAssetWrapper(FilamentAsset* assetPtr, bool loadResources = true);');
patch('cpp/core/RNFEngineImpl.cpp', 'EngineImpl::beginLoadAsset',
  'std::shared_ptr<FilamentAssetWrapper> EngineImpl::makeAssetWrapper(FilamentAsset* assetPtr) {', `std::shared_ptr<FilamentAssetWrapper> EngineImpl::beginLoadAsset(std::shared_ptr<FilamentBuffer> modelBuffer, int instanceCount) {
  std::unique_lock lock(_mutex);
  if (instanceCount < 1) throw std::invalid_argument("instanceCount must be positive");
  auto buffer = modelBuffer->getBuffer();
  FilamentAsset* assetPtr;
  if (instanceCount == 1) assetPtr = _assetLoader->createAsset(buffer->getData(), buffer->getSize());
  else {
    std::vector<FilamentInstance*> instances(instanceCount);
    assetPtr = _assetLoader->createInstancedAsset(buffer->getData(), buffer->getSize(), instances.data(), instanceCount);
  }
  auto asset = makeAssetWrapper(assetPtr, false);
  if (!_resourceLoader->asyncBeginLoad(assetPtr)) throw std::runtime_error("Could not begin model resource loading");
  return asset;
}
double EngineImpl::updateAssetLoad() {
  std::unique_lock lock(_mutex);
  _resourceLoader->asyncUpdateLoad();
  return _resourceLoader->asyncGetLoadProgress();
}
void EngineImpl::cancelAssetLoad() {
  std::unique_lock lock(_mutex);
  _resourceLoader->asyncCancelLoad();
}
std::shared_ptr<FilamentAssetWrapper> EngineImpl::makeAssetWrapper(FilamentAsset* assetPtr, bool loadResources) {`);
patch('cpp/core/RNFEngineImpl.cpp', 'if (loadResources) _resourceLoader',
  '  _resourceLoader->loadResources(asset.get());', '  if (loadResources) _resourceLoader->loadResources(asset.get());');
patch('cpp/core/RNFEngineWrapper.h', 'beginLoadAsset(',
  '  std::shared_ptr<SceneWrapper> getScene();', `  std::shared_ptr<EngineWrapper> retain();
  std::shared_ptr<FilamentAssetWrapper> beginLoadAsset(std::shared_ptr<FilamentBuffer> buffer, int instanceCount);
  double updateAssetLoad();
  void cancelAssetLoad();
  std::shared_ptr<SceneWrapper> getScene();`);
patch('cpp/core/RNFEngineWrapper.cpp', 'registerHybridMethod("beginLoadAsset"',
  '  registerHybridMethod("getScene",', `  registerHybridMethod("retain", &EngineWrapper::retain, this);
  registerHybridMethod("beginLoadAsset", &EngineWrapper::beginLoadAsset, this);
  registerHybridMethod("updateAssetLoad", &EngineWrapper::updateAssetLoad, this);
  registerHybridMethod("cancelAssetLoad", &EngineWrapper::cancelAssetLoad, this);
  registerHybridMethod("getScene",`);
patch('cpp/core/RNFEngineWrapper.cpp', 'EngineWrapper::beginLoadAsset(std::',
  'std::shared_ptr<SceneWrapper> EngineWrapper::getScene() {', `std::shared_ptr<EngineWrapper> EngineWrapper::retain() { return std::make_shared<EngineWrapper>(pointee()); }
std::shared_ptr<FilamentAssetWrapper> EngineWrapper::beginLoadAsset(std::shared_ptr<FilamentBuffer> buffer, int instanceCount) {
  return pointee()->beginLoadAsset(buffer, instanceCount);
}
double EngineWrapper::updateAssetLoad() { return pointee()->updateAssetLoad(); }
void EngineWrapper::cancelAssetLoad() { pointee()->cancelAssetLoad(); }
std::shared_ptr<SceneWrapper> EngineWrapper::getScene() {`);
for (const path of ['src/types/Engine.ts', 'lib/typescript/types/Engine.d.ts'])
  patch(path, 'beginLoadAsset(', 'export interface Engine extends PointerHolder {', `export interface Engine extends PointerHolder {
  retain(): Engine;
  beginLoadAsset(buffer: FilamentBuffer, instanceCount: number): FilamentAsset;
  updateAssetLoad(): number;
  cancelAssetLoad(): void;`);
console.log('Filament shared byte cache and incremental model loading ready.');

for (const path of ['src/index.tsx', 'lib/typescript/index.d.ts']) {
  const file = new URL(path, root), source = readFileSync(file, 'utf8');
  const exports = path.startsWith('src/')
    ? "\nexport { prepareModel, clearPreparedModels } from './utilities/PreparedModels'\n"
    : "\nexport declare function prepareModel(engine: import('./types/Engine').Engine, context: import('react-native-worklets-core').IWorkletContext, source: number | { uri: string }): void;\nexport declare function clearPreparedModels(engine: import('./types/Engine').Engine): void;\n";
  if (!source.includes('prepareModel')) writeFileSync(file, source + exports);
}
