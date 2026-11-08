/** Compile the actual native swapchain methods against a deterministic queued driver. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function method(file, signature) {
  const source = fs.readFileSync(file, 'utf8'), start = source.indexOf(signature);
  assert.ok(start >= 0, signature);
  const body = source.indexOf('{', start);
  let depth = 1, end = body + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
const engineMethod = method('node_modules/react-native-filament/cpp/core/RNFEngineImpl.cpp', 'std::shared_ptr<SwapChain> EngineImpl::createSwapChain(');
const wrapperMethod = method('node_modules/react-native-filament/cpp/core/RNFEngineWrapper.cpp', 'std::shared_ptr<SwapChainWrapper> EngineWrapper::createSwapChainForSurface(');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brainpet-surface-lifetime-'));
const source = `
#include <cassert>
#include <cstdint>
#include <functional>
#include <memory>
#include <queue>
#include <stdexcept>
#include <sys/types.h>
const char* TAG = "test";
struct Logger { template<class... T> static void log(T...) {} };
struct Surface {
  bool& alive;
  explicit Surface(bool& value): alive(value) { alive = true; }
  ~Surface() { alive = false; }
  void* getSurface() { return &alive; }
};
struct SurfaceProvider {
  std::shared_ptr<Surface> surface;
  std::shared_ptr<Surface> getSurfaceOrNull() { return surface; }
};
struct SwapChain { static constexpr uint64_t CONFIG_TRANSPARENT = 1; };
struct Dispatcher {
  std::queue<std::function<void()>> jobs;
  void runAsync(std::function<void()> job) { jobs.push(std::move(job)); }
  void drain() { while (!jobs.empty()) { auto job = std::move(jobs.front()); jobs.pop(); job(); } }
};
struct Engine {
  bool* window = nullptr;
  std::queue<std::function<void()>> driver;
  SwapChain* createSwapChain(void* nativeWindow, uint64_t) {
    window = static_cast<bool*>(nativeWindow);
    driver.push([this] { assert(*window && "Queued EGL creation needs a live window"); });
    return new SwapChain;
  }
  void destroy(SwapChain* chain) {
    driver.push([this, chain] { assert(*window && "Queued EGL destruction needs a live window"); delete chain; });
  }
  void flushAndWait() { while (!driver.empty()) { auto job = std::move(driver.front()); driver.pop(); job(); } }
};
template<class T> struct References {
  template<class D> static std::shared_ptr<T> adoptEngineRef(std::shared_ptr<Engine> engine, T* raw, D deleter) {
    return std::shared_ptr<T>(raw, [engine, deleter](T* p) { deleter(engine, p); });
  }
};
struct EngineImpl {
  std::shared_ptr<Engine> _engine = std::make_shared<Engine>();
  std::shared_ptr<Dispatcher> _rendererDispatcher = std::make_shared<Dispatcher>();
  std::shared_ptr<SwapChain> createSwapChain(void*, u_int64_t, std::shared_ptr<Surface> = nullptr);
};
struct SwapChainWrapper {
  std::shared_ptr<SwapChain> chain;
  explicit SwapChainWrapper(std::shared_ptr<SwapChain> value): chain(value) {}
};
struct EngineWrapper {
  std::shared_ptr<EngineImpl> engine = std::make_shared<EngineImpl>();
  std::shared_ptr<EngineImpl> pointee() { return engine; }
  std::shared_ptr<SwapChainWrapper> createSwapChainForSurface(std::shared_ptr<SurfaceProvider>, bool);
};
${engineMethod}
${wrapperMethod}
int main() {
  for (bool transparent : {false, true}) {
    bool alive = false;
    EngineWrapper engine;
    auto provider = std::make_shared<SurfaceProvider>();
    provider->surface = std::make_shared<Surface>(alive);
    auto swap = engine.createSwapChainForSurface(provider, transparent);
    // Android releases the view while Filament's driver still has queued creation work.
    provider->surface.reset();
    provider.reset();
    assert(alive);
    engine.engine->_engine->flushAndWait();
    assert(alive);
    swap.reset();
    // Releasing the JS wrapper only queues destruction; the window must stay alive.
    assert(alive);
    engine.engine->_rendererDispatcher->drain();
    assert(!alive && "The window must be released after driver cleanup, without a leak");
  }
}
`;
try {
  fs.writeFileSync(path.join(work, 'test.cpp'), source);
  execFileSync(process.env.CXX || 'c++', ['-std=c++20', path.join(work, 'test.cpp'), '-o', path.join(work, 'test')], { stdio: 'pipe' });
  execFileSync(path.join(work, 'test'), { stdio: 'pipe' });
  console.log('Native surface owners survive queued creation and destruction, then release after flush, with opaque and transparent swapchains.');
} finally { fs.rmSync(work, { recursive: true, force: true }); }
