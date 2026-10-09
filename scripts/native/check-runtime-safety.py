"""Exercise the patched native Bullet wrappers with real concurrent callers."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2] / 'node_modules'
filament = root / 'react-native-filament'
bullet = filament / 'ios/libs/bullet3'
build = Path(tempfile.gettempdir()) / 'brainpet-runtime-safety'
build.mkdir(exist_ok=True)
# Only stub the JSI registration layer. The world/body methods and Bullet code
# below are the actual installed native sources, including the safety patch.
(build / 'test-hybrid.h').write_text(r'''
#pragma once
#include <algorithm>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
namespace margelo {
class HybridObject {
public:
  explicit HybridObject(const char*) {}
  virtual ~HybridObject() = default;
  virtual void loadHybridMethods() {}
  template <typename... T> void registerHybridMethod(T...) {}
  template <typename... T> void registerHybridSetter(T...) {}
  template <typename... T> void registerHybridGetter(T...) {}
};
class TMat44Wrapper;
struct Logger { template <typename... T> static void log(T...) {} };
}
''')
for name in ['RNFRigidBodyWrapper.h', 'RNFDiscreteDynamicWorldWrapper.h', 'RNFActivationStateEnum.h', 'RNFBulletLock.h']:
    source = (filament / 'cpp/bullet' / name).read_text()
    source = re.sub(r'#include "(?:core/[^"\n]+|jsi/RNFHybridObject.h)"', '#include "test-hybrid.h"', source)
    # Expose methods for direct calls instead of requiring a JavaScript runtime.
    (build / name).write_text(source.replace('private:', 'public:'))
(build / 'jsi').mkdir(exist_ok=True)
(build / 'jsi/RNFEnumMapper.h').write_text((filament / 'cpp/jsi/RNFEnumMapper.h').read_text())
body = (filament / 'cpp/bullet/RNFRigidBodyWrapper.cpp').read_text()
# The unused Filament-matrix overload needs Filament headers. The origin-based
# constructor used by this app remains intact and runs in this test.
start = body.index('std::shared_ptr<RigidBodyWrapper> RigidBodyWrapper::create(double mass, std::shared_ptr<TMat44Wrapper>')
end = body.index('void RigidBodyWrapper::loadHybridMethods()', start)
(build / 'RNFRigidBodyWrapper.cpp').write_text(body[:start] + body[end:])
(build / 'RNFDiscreteDynamicWorldWrapper.cpp').write_text((filament / 'cpp/bullet/RNFDiscreteDynamicWorldWrapper.cpp').read_text())
(build / 'check.cpp').write_text(r'''
#include "RNFDiscreteDynamicWorldWrapper.h"
#include <atomic>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <thread>
using namespace margelo;
int main() {
  auto shape = std::make_shared<btSphereShape>(.12);
  auto ball = RigidBodyWrapper::create(.22, 0, .5, 0, shape, "ball", std::nullopt);
  auto world = std::make_shared<DiscreteDynamicWorldWrapper>(0, -9.81, 0);
  auto floorShape = std::make_shared<btStaticPlaneShape>(btVector3(0,1,0),0);
  auto floor = RigidBodyWrapper::create(0, 0, 0, 0, floorShape, "floor", std::nullopt);
  world->addRigidBody(floor);
  world->addRigidBody(ball);
  world->addRigidBody(ball);
  assert(world->dynamicsWorld->getNumCollisionObjects() == 2);
  world->removeRigidBody(ball);
  world->removeRigidBody(ball);
  assert(world->dynamicsWorld->getNumCollisionObjects() == 1);
  world->addRigidBody(ball);
  // Match RN cleanup while the render queue is holding the world lock.
  std::atomic<bool> entered{false}, removed{false};
  std::thread cleanup;
  {
    std::lock_guard<std::recursive_mutex> lock(bulletMutex());
    cleanup = std::thread([&] { entered = true; world->removeRigidBody(ball); removed = true; });
    while (!entered) std::this_thread::yield();
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    assert(!removed);
  }
  cleanup.join();
  assert(removed);
  world->addRigidBody(ball);
  // Three real callers: render frames, effect cleanup/mount, and body updates.
  std::atomic<bool> start{false};
  auto wait = [&] { while (!start) std::this_thread::yield(); };
  std::thread render([&] { wait(); for (int i=0;i<20000;i++) {
    world->stepSimulation(1./120, 4, 1./60);
    std::lock_guard<std::recursive_mutex> lock(bulletMutex());
    btTransform pose; ball->getRigidBody()->getMotionState()->getWorldTransform(pose);
    assert(std::isfinite(pose.getOrigin().x()));
  }});
  std::thread effects([&] { wait(); for (int i=0;i<5000;i++) {
    world->removeRigidBody(ball); world->removeRigidBody(ball);
    world->addRigidBody(ball); world->addRigidBody(ball);
  }});
  std::thread updates([&] { wait(); for (int i=0;i<20000;i++) {
    ball->setPosition(0, .5, 0); ball->setKinematic(i%2);
    ball->applyCentralImpulse(0,.001,0); ball->setFriction(.5);
    ball->setDamping(.35,.45); ball->setId("ball");
    assert(ball->getId()=="ball" && ball->getFriction()==.5);
    ball->setCollisionCallback(std::nullopt); ball->getCollisionCallback();
  }});
  start = true; render.join(); effects.join(); updates.join();
  assert(world->dynamicsWorld->getNumCollisionObjects() == 2);
  world.reset();
  assert(ball->getRigidBody()->getBroadphaseHandle()==nullptr);
  assert(floor->getRigidBody()->getBroadphaseHandle()==nullptr);
  for(int i=0;i<500;i++) {
    auto temporary=std::make_shared<DiscreteDynamicWorldWrapper>(0,-9.81,0);
    temporary->addRigidBody(ball);
  }
  assert(ball->getRigidBody()->getBroadphaseHandle()==nullptr);
  puts("Verified concurrent Bullet simulation, add/remove, body updates, duplicate cleanup and world teardown.");
}
''')
sources = [p for name in ('BulletCollision', 'BulletDynamics', 'LinearMath') for p in (bullet / name).rglob('*.cpp')]
cache = Path(tempfile.gettempdir()) / 'brainpet-ball-physics'
cache.mkdir(exist_ok=True)
def compile_source(p):
    obj = cache / (str(p.relative_to(bullet)).replace('/', '_') + '.o')
    if not obj.exists() or obj.stat().st_mtime < p.stat().st_mtime:
        subprocess.run(['clang++', '-std=c++17', '-O1', '-I'+str(bullet), '-c', str(p), '-o', str(obj)], check=True, stdout=subprocess.DEVNULL)
    return str(obj)
with ThreadPoolExecutor(max_workers=6) as pool:
    objects = list(pool.map(compile_source, sources))
subprocess.run(['clang++', '-std=c++17', '-O1', '-pthread', '-I'+str(bullet), '-I'+str(build),
                str(build / 'check.cpp'), str(build / 'RNFRigidBodyWrapper.cpp'), str(build / 'RNFDiscreteDynamicWorldWrapper.cpp'),
                *objects, '-o', str(build / 'check')], check=True)
subprocess.run([str(build / 'check')], check=True, timeout=60)

# Run the exact array getter from Worklets Core with a small JSI value stub.
source = (root / 'react-native-worklets-core/cpp/wrappers/WKTJsiArrayWrapper.h').read_text()
getter = source[source.index('  jsi::Value get(jsi::Runtime &runtime,'):source.index('  /**\n   * Returns the array as a string')]
(build / 'check-array.cpp').write_text(r'''
#include <algorithm>
#include <cassert>
#include <memory>
#include <mutex>
#include <string>
#include <vector>
namespace jsi {
struct Runtime {};
struct Value { int number=0; bool defined=false; static Value undefined() { return {}; } };
struct PropNameID { std::string name; std::string utf8(Runtime&) const { return name; } };
}
struct Wrapped { int number; };
struct JsiWrapper { static jsi::Value unwrap(jsi::Runtime&, std::shared_ptr<Wrapped> p) { return {p->number,true}; } };
struct JsiHostObject { virtual jsi::Value get(jsi::Runtime&, const jsi::PropNameID&) { return {}; } };
struct Array : JsiHostObject {
  std::mutex _readWriteMutex;
  std::vector<std::shared_ptr<Wrapped>> _array;
GETTER
};
int main() {
  jsi::Runtime runtime;
  Array array;
  assert(!array.get(runtime,{"0"}).defined);
  array._array = {std::make_shared<Wrapped>(Wrapped{42}), nullptr};
  assert(array.get(runtime,{"0"}).number==42);
  for (auto index : {"1","2","100","-1","missing"}) assert(!array.get(runtime,{index}).defined);
}
'''.replace('GETTER', getter))
subprocess.run(['clang++', '-std=c++17', '-O1', str(build / 'check-array.cpp'), '-o', str(build / 'check-array')], check=True)
subprocess.run([str(build / 'check-array')], check=True)
print('Verified the native Worklets getter returns undefined for empty, sparse and out-of-range array elements.')
