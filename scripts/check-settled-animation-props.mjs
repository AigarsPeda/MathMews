/** Run the real registry methods through delayed sync and re-animation scenarios. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const root = 'node_modules/react-native-reanimated/';
const cpp = fs.readFileSync(root + 'Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.cpp', 'utf8');
const header = fs.readFileSync(root + 'Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.h', 'utf8');
const stripIncludes = source => source.replace(/^#(?:include|pragma).*$/gm, '');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brainpet-settled-props-'));
const source = `
#include <cassert>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
#define REACT_NATIVE_VERSION_MINOR 86
#define react_native_assert assert
namespace folly { using dynamic = double; }
namespace jsi {
struct Runtime {};
struct Object;
struct Value {
  double number = 0;
  std::shared_ptr<Object> object;
  Value() = default;
  Value(double value): number(value) {}
  Value(Runtime&, const Object&);
  Object asObject(Runtime&) const;
};
struct Object {
  mutable std::unordered_map<std::string, Value> properties;
  mutable std::vector<Value> items;
  explicit Object(Runtime&) {}
  Object(Runtime&, size_t size): items(size) {}
  Object asArray(Runtime&) const { return *this; }
  size_t size(Runtime&) const { return items.size(); }
  Value getValueAtIndex(Runtime&, size_t i) const { return items.at(i); }
  void setValueAtIndex(Runtime&, size_t i, const Object& value) const { Value v; v.object = std::make_shared<Object>(value); items.at(i) = v; }
  Value getProperty(Runtime&, const char* name) const { return properties.at(name); }
  void setProperty(Runtime&, const char* name, Value value) const { properties[name] = value; }
};
using Array = Object;
Value::Value(Runtime&, const Object& value): object(std::make_shared<Object>(value)) {}
Object Value::asObject(Runtime&) const { assert(object); return *object; }
folly::dynamic dynamicFromValue(Runtime&, const Value& value) { return value.number; }
Value valueFromDynamic(Runtime&, const folly::dynamic& value) { return Value(value); }
}
namespace reanimated {
using Tag = int;
struct ShadowNode {
  int tag;
  Tag getTag() const { return tag; }
  Tag getFamilyShared() const { return tag; }
};
template<class T> struct Bridging {
  static std::shared_ptr<const ShadowNode> fromJs(jsi::Runtime&, const jsi::Value& v) { return std::make_shared<ShadowNode>(ShadowNode{static_cast<int>(v.number)}); }
};
struct StaticFeatureFlags {
  static constexpr bool getFlag(std::string_view name) { return name == "FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS"; }
};
struct UpdatesRegistryManager { static bool isLockedByCurrentThread() { return true; } };
struct UpdatesRegistry {
  std::unordered_map<Tag, std::pair<Tag, folly::dynamic>> updatesRegistry_;
  virtual void removeTag(Tag) = 0;
  void addUpdatesToBatch(Tag tag, folly::dynamic value) { updatesRegistry_[tag] = {tag, value}; }
  void addJSIPropsToAnimatedPropsBatch(Tag, jsi::Runtime&, const jsi::Value&) {}
};
}
${stripIncludes(header).replace(' private:', ' public:')}
${stripIncludes(cpp)}
using namespace reanimated;
int main() {
  jsi::Runtime rt;
  AnimatedPropsRegistry registry;
  auto record = [&](Tag tag, double value, double timestamp) {
    jsi::Array operations(rt, 1);
    jsi::Object item(rt);
    item.setProperty(rt, "shadowNodeWrapper", tag);
    item.setProperty(rt, "updates", value);
    operations.setValueAtIndex(rt, 0, item);
    registry.update(rt, jsi::Value(rt, operations), timestamp);
  };
  auto collect = [&](double timestamp) { return registry.collectSettledUpdates(rt, timestamp).asObject(rt); };
  record(1, .2, 0);
  auto first = collect(10000); // JS blocked / app paused beyond the old two-second eviction threshold
  assert(first.items.size() == 1 && first.items[0].object->properties.at("styleProps").number == .2);
  assert(registry.updatesRegistry_.contains(1)); // React must receive the value before eviction
  assert(collect(10001).items.empty() && !registry.updatesRegistry_.contains(1));
  record(1, .4, 10002); // React still has .2; a fresh animation must invalidate that snapshot
  auto fresh = collect(9000);
  assert(fresh.items.size() == 1 && fresh.items[0].object->properties.at("styleProps").number == .4);
  assert(collect(9001).items.empty()); // no repeated sync while still animating
  record(1, .6, 10003);
  assert(collect(11004).items.size() == 1);
  assert(collect(11005).items.empty()); // settle once, evict on the next tick
  registry.removeTag(1);
  assert(registry.syncedTags_.empty() && registry.invalidatedTags_.empty() && registry.timestampMap_.empty());
  record(1, .8, 12000); // recycled tag must not inherit the prior view's snapshot
  assert(collect(11000).items.empty());
  assert(collect(13001).items.size() == 1);
}
`;
try {
  fs.writeFileSync(path.join(work, 'test.cpp'), source);
  execFileSync(process.env.CXX || 'c++', ['-std=c++20', '-fsanitize=address,undefined', path.join(work, 'test.cpp'), '-o', path.join(work, 'test')], { stdio: 'pipe' });
  execFileSync(path.join(work, 'test'), { stdio: 'pipe' });
} finally { fs.rmSync(work, { recursive: true, force: true }); }

const module = { exports: {} };
let intervals = 0, active = 0, synced = [];
const collectorSource = fs.readFileSync(root + 'src/PropsRegistryGarbageCollector.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(collectorSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, Map,
  setInterval: () => { active++; return ++intervals; }, clearInterval: () => { active--; },
  require: id => id === './ReanimatedModule'
    ? { ReanimatedModule: { getSettledUpdates: () => [{ viewTag: 9, styleProps: { width: 20 } }] } }
    : { unprocessColorsInProps() {} },
});
const collector = module.exports.PropsRegistryGarbageCollector;
const view = { _syncStylePropsBackToReact: value => synced.push(value) };
collector.registerView(1, view); collector.registerView(1, view);
assert.equal(active, 1);
collector.unregisterView(1); collector.unregisterView(1);
assert.equal(active, 0, 'Nested components sharing a native tag must stop the timer once');
collector.registerView(9, view);
assert.equal(active, 1, 'The next view must restart synchronization after duplicate unregisters');
collector.syncPropsBackToReact();
assert.equal(synced[0].width, 20);
collector.unregisterView(9);
assert.equal(active, 0);
console.log('Settled values survive long pauses, refresh on re-animation, sync once before eviction, and clear on unmount; nested-view collector restarts correctly.');
