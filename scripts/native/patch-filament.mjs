// Small reproducible Bullet binding extension; upstream 1.11 omits actor poses/impulses.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root)));
if (pkg.version !== '1.11.0') throw new Error('Review the Bullet binding patch before upgrading Filament.');
function patch(path, marker, before, after) {
  const url = new URL(path, root); const source = readFileSync(url, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Filament patch context changed: ' + path);
  writeFileSync(url, source.replace(before, after));
}
patch('cpp/bullet/RNFRigidBodyWrapper.h', 'void setPosition', '  void setDamping', '  void setPosition(double x, double y, double z);\n  void applyCentralImpulse(double x, double y, double z);\n  void setKinematic(bool enabled);\n  void setDamping');
patch('cpp/bullet/RNFRigidBodyWrapper.cpp', 'RigidBodyWrapper::setPosition', 'void RigidBodyWrapper::setDamping', `void RigidBodyWrapper::setPosition(double x, double y, double z) {
  btTransform transform = _rigidBody->getWorldTransform();
  transform.setOrigin(btVector3(x, y, z));
  _rigidBody->setWorldTransform(transform);
  _rigidBody->setInterpolationWorldTransform(transform);
  _motionState->setWorldTransform(transform);
  _rigidBody->activate(true);
}
void RigidBodyWrapper::applyCentralImpulse(double x, double y, double z) {
  _rigidBody->activate(true);
  _rigidBody->applyCentralImpulse(btVector3(x, y, z));
}
void RigidBodyWrapper::setKinematic(bool enabled) {
  int flags = _rigidBody->getCollisionFlags();
  _rigidBody->setCollisionFlags(enabled ? flags | btCollisionObject::CF_KINEMATIC_OBJECT : flags & ~btCollisionObject::CF_KINEMATIC_OBJECT);
  _rigidBody->setActivationState(enabled ? DISABLE_DEACTIVATION : ACTIVE_TAG);
}
void RigidBodyWrapper::setDamping`);
patch('cpp/bullet/RNFRigidBodyWrapper.cpp', 'registerHybridMethod("setPosition"', '  registerHybridMethod("setDamping"', '  registerHybridMethod("setPosition", &RigidBodyWrapper::setPosition, this);\n  registerHybridMethod("applyCentralImpulse", &RigidBodyWrapper::applyCentralImpulse, this);\n  registerHybridMethod("setKinematic", &RigidBodyWrapper::setKinematic, this);\n  registerHybridMethod("setDamping"');
for (const path of ['src/bullet/types/RigidBody.ts', 'lib/typescript/bullet/types/RigidBody.d.ts']) {
  patch(path, 'setPosition(', 'setDamping(', 'setPosition(x: number, y: number, z: number): void;\n    applyCentralImpulse(x: number, y: number, z: number): void;\n    setKinematic(enabled: boolean): void;\n    setDamping(');
}
console.log('Filament Bullet actor/impulse bindings ready.');
