from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess
import tempfile

# Run with python3 scripts/native/check-ball-physics.py. Uses the shipped Bullet
# sources and patched constructor, without requiring React Native or a device.
root = Path(__file__).resolve().parents[2] / 'node_modules/react-native-filament'
bullet = root / 'ios/libs/bullet3'
build = Path(tempfile.gettempdir()) / 'brainpet-ball-physics'
build.mkdir(exist_ok=True)
wrapper = (root / 'cpp/bullet/RNFRigidBodyWrapper.cpp').read_text()
settings = wrapper.split('  _rigidBody = std::make_shared<btRigidBody>(rigidBodyCI);', 1)[1].split('\n}\n', 1)[0]
fixture = r'''
#include "btBulletDynamicsCommon.h"
#include <memory>
#include <cstdio>
#include <cstdlib>
std::shared_ptr<btRigidBody> makeBody(double mass, std::shared_ptr<btCollisionShape> _shape, btVector3 p) {
  btTransform t; t.setIdentity(); t.setOrigin(p);
  auto state = new btDefaultMotionState(t);
  btVector3 inertia(0,0,0); if(mass) _shape->calculateLocalInertia(mass,inertia);
  btRigidBody::btRigidBodyConstructionInfo ci(mass,state,_shape.get(),inertia);
  auto _rigidBody=std::make_shared<btRigidBody>(ci);
  SETTINGS
  return _rigidBody;
}
int main() {
  int failures=0;
  for(float radius : {.09f,.12f,.22f}) for(int fps : {30,60,120}) for(int obstacle : {0,1,2}) {
    btDefaultCollisionConfiguration config;
    btCollisionDispatcher dispatcher(&config);
    btDbvtBroadphase broadphase;
    btSequentialImpulseConstraintSolver solver;
    btDiscreteDynamicsWorld world(&dispatcher,&broadphase,&solver,&config);
    world.setGravity(btVector3(0,-9.81,0));
    auto floorShape=std::make_shared<btStaticPlaneShape>(btVector3(0,1,0),0);
    auto floor=makeBody(0,floorShape,btVector3(0,.068,0)); floor->setFriction(.7); world.addRigidBody(floor.get());
    auto ballShape=std::make_shared<btSphereShape>(radius);
    auto ball=makeBody(.22,ballShape,btVector3(0,.068+radius,0));
    ball->setFriction(.5); ball->setDamping(.35,.45); world.addRigidBody(ball.get());
    auto objectShape=std::make_shared<btBoxShape>(btVector3(obstacle==1?.05:.3,.5,.6));
    auto object=makeBody(0,objectShape,btVector3(obstacle==1?.34:.59,.568,0)); object->setFriction(.5);
    if(obstacle)world.addRigidBody(object.get());
    for(int i=0;i<fps;i++)world.stepSimulation(1.f/fps,4,1.f/60);
    ball->activate(true); ball->applyCentralImpulse(btVector3(.12,.025,0));
    float maxX=0,minVelocity=0;
    for(int i=0;i<fps*8;i++) {
      world.stepSimulation(1.f/fps,4,1.f/60);
      maxX=btMax(maxX,ball->getWorldTransform().getOrigin().x());
      minVelocity=btMin(minVelocity,ball->getLinearVelocity().x());
    }
    float finalX=ball->getWorldTransform().getOrigin().x();
    float speed=ball->getLinearVelocity().length();
    printf("radius %.2f, %d FPS, %s: travel %.3f, final %.3f, rebound velocity %.3f, final speed %.4f\n",radius,fps,obstacle==0?"open floor":obstacle==1?"wall":"furniture",maxX,finalX,minVelocity,speed);
    if(!obstacle && (maxX<.18 || maxX>1.2 || speed>.01))failures++;
    if(obstacle && (minVelocity>-.05 || finalX>=maxX-.03 || maxX>.29-radius+.02))failures++;
    if(!obstacle) {
      ball->activate(true); ball->applyCentralImpulse(btVector3(.12,.025,0));
      for(int i=0;i<fps*8;i++)world.stepSimulation(1.f/fps,4,1.f/60);
      float secondRoll=ball->getWorldTransform().getOrigin().x()-finalX;
      if(secondRoll<.18 || secondRoll>1.2 || ball->getLinearVelocity().length()>.01)failures++;
    }
    if(obstacle)world.removeRigidBody(object.get());
    world.removeRigidBody(ball.get()); world.removeRigidBody(floor.get());
  }
  return failures?1:0;
}
'''.replace('SETTINGS',settings)
(build / 'check.cpp').write_text(fixture)
sources = [p for name in ('BulletCollision','BulletDynamics','LinearMath') for p in (bullet/name).rglob('*.cpp')]
def compile_source(p):
    obj=build / (str(p.relative_to(bullet)).replace('/','_')+'.o')
    if not obj.exists() or obj.stat().st_mtime < p.stat().st_mtime:
        subprocess.run(['clang++','-std=c++17','-O1','-I'+str(bullet),'-c',str(p),'-o',str(obj)],check=True,stdout=subprocess.DEVNULL)
    return str(obj)
with ThreadPoolExecutor(max_workers=6) as pool:
    objects=list(pool.map(compile_source,sources))
subprocess.run(['clang++','-std=c++17','-O1','-I'+str(bullet),str(build/'check.cpp'),*objects,'-o',str(build/'check')],check=True)
raise SystemExit(subprocess.run([str(build/'check')]).returncode)
