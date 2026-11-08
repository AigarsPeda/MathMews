// Filament's driver uses the native window after createSwapChain returns.
// Retain its owner through queued swapchain destruction and flushAndWait.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
if (JSON.parse(readFileSync(new URL('package.json', root))).version !== '1.11.0')
  throw new Error('Review the surface lifetime patch before upgrading Filament.');
function patch(file, marker, before, after) {
  const url = new URL(file, root), source = readFileSync(url, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Filament surface lifetime patch context changed: ' + file);
  writeFileSync(url, source.replace(before, after));
}
patch('cpp/core/RNFEngineImpl.h', 'std::shared_ptr<Surface> retainedSurface',
  'createSwapChain(void* nativeWindow, u_int64_t flags);',
  'createSwapChain(void* nativeWindow, u_int64_t flags, std::shared_ptr<Surface> retainedSurface = nullptr);');
patch('cpp/core/RNFEngineImpl.cpp', 'EngineImpl::createSwapChain(void* nativeWindow, u_int64_t flags,',
  'EngineImpl::createSwapChain(void* nativeWindow, u_int64_t flags = 0)',
  'EngineImpl::createSwapChain(void* nativeWindow, u_int64_t flags, std::shared_ptr<Surface> retainedSurface)');
patch('cpp/core/RNFEngineImpl.cpp', '[dispatcher, retainedSurface]',
  '[dispatcher](std::shared_ptr<Engine> engine, SwapChain* swapChain)',
  '[dispatcher, retainedSurface](std::shared_ptr<Engine> engine, SwapChain* swapChain)');
patch('cpp/core/RNFEngineImpl.cpp', '[engine, swapChain, retainedSurface]',
  'dispatcher->runAsync([engine, swapChain]()',
  'dispatcher->runAsync([engine, swapChain, retainedSurface]()');
patch('cpp/core/RNFEngineWrapper.cpp', 'createSwapChain(nativeWindow, flags, surface)',
  'pointee()->createSwapChain(nativeWindow, flags)',
  'pointee()->createSwapChain(nativeWindow, flags, surface)');
console.log('Filament swapchains retain native surfaces through driver cleanup.');
