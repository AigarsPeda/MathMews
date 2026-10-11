// Device shadows with a deterministic fallback for Metal's iOS simulator.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
if (JSON.parse(readFileSync(new URL('package.json', root))).version !== '1.11.0')
  throw new Error('Review the shadow bindings before upgrading Filament.');
function patch(path, marker, before, after) {
  const url = new URL(path, root), source = readFileSync(url, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Filament shadow patch context changed: ' + path);
  writeFileSync(url, source.replace(before, after));
}
patch('cpp/core/RNFLightManagerWrapper.h', 'bool getShadowMapsSupported()',
  'private: // JS API:', 'private: // JS API:\n  bool getShadowMapsSupported();');
patch('cpp/core/RNFLightManagerWrapper.cpp', '#include <TargetConditionals.h>',
  '#include <utils/Entity.h>', '#if defined(__APPLE__)\n#include <TargetConditionals.h>\n#endif\n#include <utils/Entity.h>');
patch('cpp/core/RNFLightManagerWrapper.cpp', 'registerHybridGetter("shadowMapsSupported"',
  'void LightManagerWrapper::loadHybridMethods() {',
  'void LightManagerWrapper::loadHybridMethods() {\n  registerHybridGetter("shadowMapsSupported", &LightManagerWrapper::getShadowMapsSupported, this);');
patch('cpp/core/RNFLightManagerWrapper.cpp', 'bool LightManagerWrapper::getShadowMapsSupported()',
  'void LightManagerWrapper::destroy(', `bool LightManagerWrapper::getShadowMapsSupported() {
#if defined(__APPLE__) && TARGET_OS_SIMULATOR
  return false;
#else
  return true;
#endif
}

void LightManagerWrapper::destroy(`);
patch('cpp/core/RNFLightManagerWrapper.cpp', 'shadowOptions.mapSize = 1024',
  '    builder.castShadows(castShadows.value());', `    const bool enabled = castShadows.value() && getShadowMapsSupported();
    builder.castShadows(enabled);
    if (enabled) {
      LightManager::ShadowOptions shadowOptions;
      shadowOptions.mapSize = 1024;
      shadowOptions.stable = true;
      builder.shadowOptions(shadowOptions);
    }`);
for (const path of ['src/types/LightManager.ts', 'lib/typescript/types/LightManager.d.ts'])
  patch(path, 'readonly shadowMapsSupported:', 'export interface LightManager extends PointerHolder {',
    'export interface LightManager extends PointerHolder {\n  /** False on iOS simulator, where Metal shadow sampling is unreliable. */\n  readonly shadowMapsSupported: boolean;');
patch('cpp/core/RNFViewWrapper.cpp', 'ShadowType::DPCF',
  '  pointee()->setShadowingEnabled(enabled);',
  '  pointee()->setShadowType(View::ShadowType::DPCF);\n  pointee()->setShadowingEnabled(enabled);');
// Glass and unlit sky/lens/decal meshes must not become opaque shadow blockers.
patch('cpp/core/RNFRenderableManagerImpl.cpp', '#include <filament/Material.h>',
  '#include <filament/MaterialInstance.h>', '#include <filament/Material.h>\n#include <filament/MaterialInstance.h>');
patch('cpp/core/RNFRenderableManagerImpl.cpp', 'material->getShading() == Shading::UNLIT',
  '  renderableManager.setCastShadows(renderable, castShadow);', `  if (castShadow) {
    for (size_t i = 0; i < renderableManager.getPrimitiveCount(renderable); ++i) {
      const Material* material = renderableManager.getMaterialInstanceAt(renderable, i)->getMaterial();
      const BlendingMode blending = material->getBlendingMode();
      if (material->getShading() == Shading::UNLIT ||
          (blending != BlendingMode::OPAQUE && blending != BlendingMode::MASKED)) {
        castShadow = false;
        break;
      }
    }
  }
  renderableManager.setCastShadows(renderable, castShadow);`);
