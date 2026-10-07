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
// Bullet combines both materials' restitution. Static room colliders must also
// have a nonzero coefficient for kicked toys to rebound from furniture/walls.
patch('cpp/bullet/RNFRigidBodyWrapper.cpp', 'setCcdSweptSphereRadius',
  '  _rigidBody = std::make_shared<btRigidBody>(rigidBodyCI);', `  _rigidBody = std::make_shared<btRigidBody>(rigidBodyCI);
  _rigidBody->setRestitution(mass > 0.0 ? 0.75 : 0.8);
  if (mass > 0.0 && _shape->getShapeType() == SPHERE_SHAPE_PROXYTYPE) {
    const btScalar radius = static_cast<btSphereShape*>(_shape.get())->getRadius();
    _rigidBody->setCcdMotionThreshold(radius * 0.5);
    _rigidBody->setCcdSweptSphereRadius(radius * 0.9);
    _rigidBody->setContactProcessingThreshold(0.0);
    _rigidBody->setRollingFriction(0.002);
    _rigidBody->setSpinningFriction(0.002);
  }`);
// Upgrade already-patched installations too. Small toys need low rolling
// resistance so a paw tap carries them far enough for the next chase step.
patch('cpp/bullet/RNFRigidBodyWrapper.cpp', 'setRollingFriction(0.002)',
  'setRollingFriction(0.08);\n    _rigidBody->setSpinningFriction(0.04);',
  'setRollingFriction(0.002);\n    _rigidBody->setSpinningFriction(0.002);');
// Resolve small-toy contacts at impact. Processing separated contacts early
// brakes a gentle roll before restitution can produce a rebound.
patch('cpp/bullet/RNFRigidBodyWrapper.cpp', 'setContactProcessingThreshold(0.0)',
  '_rigidBody->setCcdSweptSphereRadius(radius * 0.9);',
  '_rigidBody->setCcdSweptSphereRadius(radius * 0.9);\n    _rigidBody->setContactProcessingThreshold(0.0);');
console.log('Filament Bullet actor/impulse bindings ready.');
