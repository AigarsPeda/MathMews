// React effects and Filament render callbacks access Bullet on different threads.
// Keep this patch reproducible on install, including clean EAS builds.
import { readFileSync, writeFileSync } from 'node:fs';
const filament = new URL('../../node_modules/react-native-filament/', import.meta.url);
const worklets = new URL('../../node_modules/react-native-worklets-core/', import.meta.url);
if (JSON.parse(readFileSync(new URL('package.json', filament))).version !== '1.11.0')
  throw new Error('Review the Bullet concurrency patch before upgrading Filament.');
if (JSON.parse(readFileSync(new URL('package.json', worklets))).version !== '1.6.3')
  throw new Error('Review the shared-array bounds patch before upgrading Worklets Core.');
function patch(root, path, marker, before, after) {
  const url = new URL(path, root), source = readFileSync(url, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Runtime safety patch context changed: ' + path);
  writeFileSync(url, source.replace(before, after));
}
writeFileSync(new URL('cpp/bullet/RNFBulletLock.h', filament), `#pragma once
#include <mutex>

namespace margelo {
// Bodies may move between worlds. One lock also protects their render-time reads.
// Collision callbacks can call body methods synchronously, so it is recursive.
inline std::recursive_mutex& bulletMutex() {
  static std::recursive_mutex mutex;
  return mutex;
}
} // namespace margelo
`);
patch(filament, 'cpp/bullet/RNFRigidBodyWrapper.h', '#include "RNFBulletLock.h"',
  '#include "RNFActivationStateEnum.h"', '#include "RNFActivationStateEnum.h"\n#include "RNFBulletLock.h"');
const bodyFile = 'cpp/bullet/RNFRigidBodyWrapper.cpp';
for (const signature of [
  'void RigidBodyWrapper::setPosition(double x, double y, double z)',
  'void RigidBodyWrapper::applyCentralImpulse(double x, double y, double z)',
  'void RigidBodyWrapper::setKinematic(bool enabled)',
  'void RigidBodyWrapper::setDamping(double linearDamping, double angularDamping)',
  'void RigidBodyWrapper::setFriction(double friction)',
  'double RigidBodyWrapper::getFriction()',
  'void RigidBodyWrapper::setActivationState(std::string activationState)',
  'std::string RigidBodyWrapper::getActivationState()',
  'void RigidBodyWrapper::setId(std::string id)',
  'std::string RigidBodyWrapper::getId()',
  'void RigidBodyWrapper::setCollisionCallback(std::optional<CollisionCallback> callback)',
  'std::optional<CollisionCallback> RigidBodyWrapper::getCollisionCallback()',
]) {
  const guarded = signature + ' {\n  std::lock_guard<std::recursive_mutex> bulletLock(bulletMutex());';
  patch(filament, bodyFile, guarded, signature + ' {', guarded);
}
patch(filament, 'cpp/bullet/RNFDiscreteDynamicWorldWrapper.h', '~DiscreteDynamicWorldWrapper()',
  '  void loadHybridMethods() override;', '  ~DiscreteDynamicWorldWrapper() override;\n\n  void loadHybridMethods() override;');
const worldFile = 'cpp/bullet/RNFDiscreteDynamicWorldWrapper.cpp';
patch(filament, worldFile, '#include <algorithm>', '#include "RNFDiscreteDynamicWorldWrapper.h"',
  '#include "RNFDiscreteDynamicWorldWrapper.h"\n#include <algorithm>');
patch(filament, worldFile, 'DiscreteDynamicWorldWrapper::~DiscreteDynamicWorldWrapper()',
  'void DiscreteDynamicWorldWrapper::loadHybridMethods()', `DiscreteDynamicWorldWrapper::~DiscreteDynamicWorldWrapper() {
  std::lock_guard<std::recursive_mutex> bulletLock(bulletMutex());
  // Unregister bodies while their shapes and motion states still exist.
  for (auto& rigidBody : *rigidBodies) dynamicsWorld->removeRigidBody(rigidBody->getRigidBody().get());
  rigidBodies->clear();
  dynamicsWorld.reset();
  solver.reset();
  dispatcher.reset();
  collisionConfiguration.reset();
  broadphase.reset();
}

void DiscreteDynamicWorldWrapper::loadHybridMethods()`);
for (const signature of [
  'void DiscreteDynamicWorldWrapper::addRigidBody(std::shared_ptr<RigidBodyWrapper> rigidBody)',
  'void DiscreteDynamicWorldWrapper::removeRigidBody(std::shared_ptr<RigidBodyWrapper> rigidBody)',
  'void DiscreteDynamicWorldWrapper::stepSimulation(double timeStep, double maxSubSteps, double fixedTimeStep)',
]) {
  const guarded = signature + ' {\n  std::lock_guard<std::recursive_mutex> bulletLock(bulletMutex());';
  patch(filament, worldFile, guarded, signature + ' {', guarded);
}
patch(filament, worldFile, 'if (std::find(rigidBodies->begin(), rigidBodies->end(), rigidBody) != rigidBodies->end()) return;',
  '  dynamicsWorld->addRigidBody(body);',
  '  if (std::find(rigidBodies->begin(), rigidBodies->end(), rigidBody) != rigidBodies->end()) return;\n  dynamicsWorld->addRigidBody(body);');
patch(filament, worldFile, 'if (std::find(rigidBodies->begin(), rigidBodies->end(), rigidBody) == rigidBodies->end()) return;',
  '  dynamicsWorld->removeRigidBody(body);',
  '  if (std::find(rigidBodies->begin(), rigidBodies->end(), rigidBody) == rigidBodies->end()) return;\n  dynamicsWorld->removeRigidBody(body);');
const transformFile = 'cpp/core/RNFTransformManagerImpl.cpp';
const transformSignature = 'void TransformManagerImpl::updateTransformByRigidBody(Entity entity, std::shared_ptr<RigidBodyWrapper> rigidBody)';
patch(filament, transformFile, transformSignature + ' {\n  std::lock_guard<std::recursive_mutex> bulletLock(bulletMutex());',
  transformSignature + ' {', transformSignature + ' {\n  std::lock_guard<std::recursive_mutex> bulletLock(bulletMutex());');
// Standard JavaScript returns undefined for an absent array element. Upstream
// directly indexes std::vector here, causing the observed native abort instead.
patch(worklets, 'cpp/wrappers/WKTJsiArrayWrapper.h', 'if (index >= _array.size()) return jsi::Value::undefined();',
  '      auto prop = _array[index];',
  '      if (index >= _array.size()) return jsi::Value::undefined();\n      auto prop = _array[index];\n      if (!prop) return jsi::Value::undefined();');
console.log('Bullet concurrency, body teardown and Worklets array bounds guards ready.');
