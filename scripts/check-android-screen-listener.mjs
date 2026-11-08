/** Exercise the patched C++ listener against minimal Fabric transaction types. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = 'node_modules/react-native-screens/';
const header = fs.readFileSync(root + 'cpp/RNSScreenRemovalListener.h', 'utf8');
const implementation = fs.readFileSync(root + 'cpp/RNSScreenRemovalListener.cpp', 'utf8');
const proxy = fs.readFileSync(root + 'android/src/main/cpp/NativeProxy.cpp', 'utf8');
const start = proxy.indexOf('const std::shared_ptr<RNSScreenRemovalListener> &removalListener()');
assert.ok(start >= 0, 'Use the process-lifetime listener from the upstream fix');
const end = proxy.indexOf('\n}', start) + 2;
const stripIncludes = source => source.replace(/^#(?:include|pragma).*$/gm, '');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brainpet-screen-listener-'));
const source = `
#include <atomic>
#include <barrier>
#include <cassert>
#include <cstdint>
#include <cstring>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <thread>
#include <utility>
#include <vector>
namespace facebook::react {
using SurfaceId = int;
struct TransactionTelemetry {};
struct ShadowViewMutation {
  enum class Type { Remove, Create } type;
  struct { const char* componentName; int tag; } oldChildShadowView;
};
using ShadowViewMutationList = std::vector<ShadowViewMutation>;
struct MountingTransaction {
  using Number = int;
  SurfaceId surfaceId; Number number; ShadowViewMutationList mutations; TransactionTelemetry telemetry;
};
struct MountingOverrideDelegate {
  virtual bool shouldOverridePullTransaction() const = 0;
  virtual ~MountingOverrideDelegate() = default;
  virtual std::optional<MountingTransaction> pullTransaction(SurfaceId, int, const TransactionTelemetry&, ShadowViewMutationList) const = 0;
};
}
${stripIncludes(header)}
${stripIncludes(implementation)}
${proxy.slice(start, end)}
int main() {
  constexpr int threads = 32;
  std::barrier ready(threads);
  std::vector<std::thread> workers;
  std::vector<const RNSScreenRemovalListener*> addresses(threads);
  std::vector<uint64_t> tokens(threads);
  std::atomic<int> notified{-1}, calls{0};
  for (int i = 0; i < threads; ++i) workers.emplace_back([&, i] {
    ready.arrive_and_wait();
    auto listener = removalListener();
    addresses[i] = listener.get();
    tokens[i] = listener->setListener([&, i](int tag) { assert(tag == 42); notified = i; ++calls; });
  });
  for (auto& thread : workers) thread.join();
  auto listener = removalListener();
  uint64_t latest = 0; int owner = -1;
  for (int i = 0; i < threads; ++i) {
    assert(addresses[i] == listener.get());
    if (tokens[i] > latest) { latest = tokens[i]; owner = i; }
  }
  auto pull = [&] {
    auto transaction = listener->pullTransaction(7, 19, {}, {
      {ShadowViewMutation::Type::Create, {"RNSScreen", 42}},
      {ShadowViewMutation::Type::Remove, {"View", 42}},
      {ShadowViewMutation::Type::Remove, {"RNSScreen", 42}}
    });
    assert(transaction && transaction->surfaceId == 7 && transaction->number == 19);
    assert(transaction->mutations.size() == 3);
  };
  for (auto token : tokens) if (token != latest) listener->clearListener(token);
  pull();
  assert(calls == 1 && notified == owner); // stale teardown cannot disarm the latest install
  listener->clearListener(latest);
  pull(); assert(calls == 1); // disarmed transactions pass through without notifications
  auto reference = std::make_shared<int>(1);
  std::weak_ptr<int> weak = reference;
  uint64_t token = listener->setListener([reference](int) {});
  reference.reset(); assert(!weak.expired());
  listener->clearListener(token); assert(weak.expired()); // captured JNI owner can be collected
  token = listener->setListener([&](int) { listener->clearListener(token); ++calls; });
  pull(); pull(); assert(calls == 2); // callback runs outside the listener mutex
  workers.clear();
  for (int i = 0; i < threads; ++i) workers.emplace_back([&] {
    for (int j = 0; j < 500; ++j) {
      auto token = listener->setListener([](int) {});
      pull();
      listener->clearListener(token);
    }
  });
  for (auto& thread : workers) thread.join();
}
`;
try {
  // Simulate a clean install, repeat postinstall, then reject source drift.
  const files = ['android/src/main/cpp/NativeProxy.cpp', 'android/src/main/cpp/NativeProxy.h', 'cpp/RNSScreenRemovalListener.cpp', 'cpp/RNSScreenRemovalListener.h'];
  const isolated = path.join(work, root);
  for (const file of [...files, 'package.json']) {
    fs.mkdirSync(path.dirname(path.join(isolated, file)), { recursive: true });
    fs.copyFileSync(root + file, path.join(isolated, file));
  }
  const script = 'scripts/native/patch-android-screen-listener.mjs';
  const patch = 'scripts/native/patches/react-native-screens-4.26.2-removal-listener.patch';
  fs.mkdirSync(path.join(work, 'scripts/native/patches'), { recursive: true });
  for (const file of [script, patch]) fs.copyFileSync(file, path.join(work, file));
  execFileSync('patch', ['-p1', '--force', '--reverse'], { cwd: isolated, input: fs.readFileSync(patch), stdio: 'pipe' });
  for (let repeat = 0; repeat < 2; repeat++) {
    execFileSync(process.execPath, [path.join(work, script)], { stdio: 'pipe' });
    for (const file of files) assert.equal(fs.readFileSync(path.join(isolated, file), 'utf8'), fs.readFileSync(root + file, 'utf8'));
  }
  fs.appendFileSync(path.join(isolated, files[0]), '\n// unexpected package change\n');
  assert.throws(() => execFileSync(process.execPath, [path.join(work, script)], { stdio: 'pipe' }));
  fs.writeFileSync(path.join(work, 'test.cpp'), source);
  execFileSync(process.env.CXX || 'c++', ['-std=c++20', '-pthread', '-fsanitize=address,undefined', path.join(work, 'test.cpp'), '-o', path.join(work, 'test')], { stdio: 'pipe' });
  execFileSync(path.join(work, 'test'), { stdio: 'pipe', timeout: 30000 });
  console.log('Native screen listener passed concurrent initialization, 16,000 install/pull/clear cycles, stale teardown, disarmed pass-through and callback release checks.');
  console.log('Clean-install patching, repeat postinstall and source-drift rejection passed.');
} finally { fs.rmSync(work, { recursive: true, force: true }); }
