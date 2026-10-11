# Mobile engine and performance study

Date: 11 October 2026. Scope: MathMews on iOS and Android. Web support is not a selection requirement.

Keep React Native and Filament for the next optimization pass. The app has measurable CPU costs in placement and room construction, plus repeated native asset loading. An engine replacement would still need to solve these problems. Investigate the simulator's shadow path separately from physical iPhone support. Filament already targets iOS through Metal; its iOS documentation specifically warns that shadows may render incorrectly in the simulator. [Filament iOS samples](https://github.com/google/filament/blob/main/ios/samples/README.md).

If this approach fails the device tests below, compare one representative room in Babylon Native and Unity URP before choosing a migration. Godot is a reasonable option for a larger game rewrite. No alternative has yet demonstrated better performance on this app's content.

## Baseline before the implementation pass

The installed stack is Expo 57, React Native 0.86.3, React 19.2.3, Hermes and `react-native-filament` 1.11.0. The iOS deployment target is 16.4. React Native owns the interface, purchases, puzzles, localization and saves. Filament renders the rooms and cat; Bullet handles toy physics. Rendering uses a dedicated native worklet/render thread. The wrapper chooses Metal on iOS and defaults to OpenGL on Android. Android Vulkan is an available backend to benchmark, not an automatic speed improvement. [React Native Filament](https://github.com/margelo/react-native-filament).

The upstream release listing also identifies 1.11.0 as the latest wrapper release at the time of this study. Upgrading Google's underlying Filament is a separate source/binary integration task, not simply installing a newer npm version. Existing Bullet, recovery and shadow patches are pinned to 1.11.0. [Wrapper releases](https://github.com/margelo/react-native-filament/releases).

| Path | Confirmed behavior | Consequence |
| --- | --- | --- |
| Four home rooms | `app/index.tsx` mounts all four stages. Each `NativeRoomSurface` mounts its own `FilamentScene`, which creates its own Engine, view and managers. | Room assets remain resident, but resources cannot be shared across these engines. |
| Prepared room switch | `useRoomTransition` immediately commits a room already marked ready; it holds the outgoing view for a cold room. | There is no intentional one-second delay for a prepared room. Remaining delay needs CPU, renderer-resume and presentation traces. |
| Coin purchase | `purchaseDecoration` updates wallet, inventory and placed objects locally and synchronously. Local persistence runs afterward; cloud pushes are debounced. | Neither a server acknowledgement nor the cloud debounce gates the purchase. Real-money billing is a different path. |
| Automatic placement | `PetStage` checks the new item's position and calls `nearestFree` if blocked. That search runs synchronously on JavaScript. | A crowded room can delay the interface while candidate positions are checked. |
| World construction | `buildNativeRoomWorld` rebuilds bounds and surface support, and searches for accessible cat and furniture approach positions. | Rebuilding an unchanged layout or recomputing every approach can consume frame time. |
| New native object | `RoomObject` calls `useModel` for each instance; `useBuffer` reads its asset, then `engine.loadAsset` creates and loads it. | A warm room does not imply a warm model that has never been instantiated in that engine. |
| Native resource loading | `EngineImpl::makeAssetWrapper` calls synchronous `ResourceLoader::loadResources` under the engine load lock. | The JavaScript-facing Promise does not make native resource loading incremental. |
| Store preview | A preview mounts another room renderer with its own engine. Buying closes it and creates the purchased instance in the home renderer. | Preview loading does not currently warm a reusable home-engine instance. |
| Readiness | The scene waits for loaded objects and three render-callback turns. | About 50 ms at 60 Hz under ideal scheduling, plus the preceding loads. These callbacks do not directly measure screen presentation. |

These are code findings, not a claim that all four worlds rebuild on every purchase. Existing memoization can retain unchanged worlds. A React profile must show which dependencies actually change in the reported interaction.

Source locations: [room stages](../app/index.tsx), [room transition](../hooks/use-room-transition.ts), [purchase](../contexts/GameProvider.tsx), [placement effect](../components/pet/PetStage.tsx), [native scene](../components/pet/native/NativeRoomScene.tsx), [world construction](../utils/native-room-world.ts), [placement search](../utils/room-item-placement.ts), [preview](../components/store/StorePreviewSheet.tsx), [storage](../utils/game-storage.ts). The installed wrapper sources are `src/react/FilamentScene.tsx`, `src/hooks/useModel.ts`, `src/hooks/useBuffer.ts` and `cpp/core/RNFEngineImpl.cpp` under `node_modules/react-native-filament`.

## Measured CPU costs

The reproducible [benchmark](../scripts/benchmark-room-loading.mjs) runs the shipped TypeScript functions through the same Node/VM technique used by the placement checks. The [recorded output](benchmarks/room-loading-2026-10-11.json) comes from Node 22.16.0 on an Apple M1 Max. Fixtures contain overlapping objects to stress recovery. Each operation starts from the same snapshot; these are synthetic cases, not the user's saved room.

Median milliseconds per operation:

| Objects per room | Purchase state calculation | Room state switch | Construct four worlds | Find space for an island | Serialize save |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.028 | 0.019 | 26.529 | 2.532 | 0.017 |
| 30 | 0.132 | 0.110 | 295.469 | 307.368 | 0.046 |
| 60 | 0.462 | 0.442 | 849.727 | 2430.756 | 0.090 |

Purchase and switch samples use 100 batches of 10 calculations. World construction uses 15 samples; placement search uses five, so its tail values are only exploratory. The purchase calculation covers validation, ownership, item insertion, layer order, ledger and retired-door cleanup. It excludes React rendering and the provider's clock normalization.

The test excludes Hermes, React, filesystem/network reads, GLB parsing, texture decoding, GPU upload, actual frames and persistence I/O. Do not use these values as phone latency or as engine comparisons. They demonstrate that placement and world construction can already consume hundreds of milliseconds without any graphics engine work. Keeping the same searches during a migration would retain this cost.

`nearestFree` considers up to 900 floor positions or 510 wall positions, sorts them by distance, and tests them until one fits. Crowded fixtures force many collision checks. World construction also runs floor searches for blocked cat and seating approaches. These are the first algorithms to optimize and measure in the real room.

The bundled native directory has 401 GLBs totaling 63.96 MiB on disk. This includes effects and cats, not just purchasable objects. Each cat coat is approximately 4.7 to 4.8 MiB. File bytes do not estimate resident memory: decoded textures, geometry, animation data, materials, render targets and duplicated engines all add memory. Loading all catalog objects into GPU memory at launch needs a device memory budget.

To reproduce from the repository root:

```sh
node scripts/benchmark-room-loading.mjs
```

## Shadows on iPhones and in the simulator

The current `shadowMapsSupported` property is our compile-time policy: false for `TARGET_OS_SIMULATOR`, true elsewhere. It is not a measured hardware capability test. Supported device builds request casting and receiving for opaque room, furniture and cat geometry. The app uses DPCF soft filtering, stable 1024-pixel maps, one sun/moon and at most two shaded lamps. Glass and unlit effects are excluded. Physical iPhone and Android shadow appearance still needs visual validation.

The previous simulator experiments are documented in [the engine notes](native-room-engine.md): enabling maps darkened whole light pools, even with casters disabled, and darkened a directional-light test. That result warrants investigation of the depth/shadow sampling path. It does not establish that iOS devices lack shadows, or that the fault must be in Apple rather than the wrapper or its bundled Filament version. The upstream simulator warning describes a limitation without promising a fix. [Filament iOS samples](https://github.com/google/filament/blob/main/ios/samples/README.md).

Run a small diagnostic before rebuilding the whole game:

1. Use one opaque ground plane, one opaque cube, one directional light and a simple camera. Disable ambient occlusion, transparent render targets and all room effects. Use the exact bundled engine version.
2. Add a development-only way to select PCF, DPCF and VSM. Start with plain PCF. VSM has different participation rules, so test it as a separate configuration.
3. Compare the official native Filament sample with the React Native wrapper on the same simulator/runtime. If only the wrapper fails, investigate its view, render target and light setup. If both fail, investigate the engine backend or simulator behavior.
4. Capture a frame with Metal validation and inspect the depth attachment, clear value, shadow sampler and light projection. Check depth formats, clipping conventions and shader/library version matching. These are diagnostic hypotheses, not identified defects.
5. Run the same scene on a physical iPhone and an Android device. If physical devices pass, keep the production configuration while investigating simulator support.
6. If necessary, rebuild a pinned newer Filament core with matching material tools and binary dependencies. Updating only a C++ header or one static library is insufficient. Repeat the minimal test before importing the change into the game.

Remove the simulator guard only after the minimal test and the actual furnished rooms pass. A PCF-only simulator configuration is a useful outcome even if devices retain DPCF. If all supported simulator paths fail, retain contact shadows and use physical devices or a native macOS rendering harness for visual development.

There is also a separate light limitation: Filament supports shadow casting from directional, sun and spot lights, not point lights. The ghost and lava lamps use point lights and therefore illuminate without their own shadow map. Objects can still cast shadows under the directional or spot lights. [Filament light API](https://github.com/google/filament/blob/main/filament/include/filament/LightManager.h).

More lights with shadows cost more rendering in any engine. Unity, for example, documents that a point-light shadow requires six directions and substantial mobile resources. Preserve a light budget instead of giving every lamp its own map. [Unity shadow mapping](https://docs.unity.com/en-us/engine/6000.0/manual/lighting-overview/shadows/shadow-realtime/shadow-mapping).

## Engine alternatives

The judgments in this table concern this app's assets, React Native interface and existing interactions. They are engineering estimates of fit and migration scope, not measured performance rankings.

| Option | iOS and Android fit | Work for this app | Decision |
| --- | --- | --- | --- |
| Keep React Native Filament | Native mobile rendering and existing GLBs, animations and Bullet integration | Optimize searches, loading and scene ownership; preserve the app | Preferred next step |
| Filament with a controlled native binding | Same renderer, with explicit shared-engine scenes, asset pools and incremental loads | Substantial C++/binding work; keep UI, saves and assets | Escalate here if wrapper APIs prevent the required improvements |
| Babylon Native with React Native | Native graphics with Babylon's JavaScript scene APIs | Port rendering, animation, physics integration, materials, picking and editor previews; verify Expo/RN compatibility | Strongest alternative to prototype while retaining React Native |
| Unity with URP | Full mobile game engine with shadow and profiling tools | Port game rendering and interaction controllers to Unity; adapt UI/native integrations and build pipeline | Strong candidate if the project needs a full game engine |
| Godot Mobile renderer | Full game engine suitable for mobile 3D | Port scenes, controllers and integration; embedded React Native hosting needs separate validation | Consider for a broader rewrite with an open-source engine |
| Three.js with React Native WebGPU | Dawn-based native GPU binding; Expo examples exist | Port scene, materials, animation, physics and interaction code; test exact versions and devices | Worth a bounded prototype, not a demonstrated speed upgrade |
| React Three Fiber with Expo GL | Native integration through Expo GL | Similar rendering rewrite; moves away from our current Metal path | Low priority for a mobile-only performance migration |

### Babylon Native

Babylon React Native supports Android and iOS and uses native graphics APIs. Its project documentation identifies a single active view limitation and possible costs in JavaScript-heavy scenarios. It also says Expo is not officially supported or tested. Its package guide lists release 2.0.2 with Babylon.js 9.0.0 and React Native 0.79.4, while the next branch lists RN 0.81.6+. Compatibility with our Expo 57/RN 0.86.3 app must be proven in a small build before planning a migration. [Project limitations](https://github.com/BabylonJS/BabylonReactNative), [package compatibility](https://github.com/BabylonJS/BabylonReactNative/blob/master/Modules/@babylonjs/react-native/README.md), [native graphics overview](https://www.babylonjs.com/reactnative/).

A prototype should load the shipped kitchen and animated cat, preserve independent lamp materials, show day/night shadows, perform picking and add ten repeated items. Compare measured latency and memory with an optimized Filament baseline. Sharing the JavaScript language does not make the existing Filament hooks portable.

### Unity

Unity is the clearest route if animation tooling, game physics and scene authoring become the main product needs. The important integration constraint is the current app's room panel inside native UI. Unity's official library documentation supports iOS/Android but specifies full-screen rendering, a single runtime, and 80 to 180 MB retained after unloading. A third-party embedding wrapper does not erase these official constraints. Test the required panel/overlay arrangement first, or treat this as a move to a Unity-owned game screen. [Unity as a Library](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/cross-platform-features/unityasa-library).

Blender sources and most geometry can be reused through a new import pipeline. Rendering controllers, animation completion, tail contacts, Bullet toy behavior, lighting, room editor and accessible object actions still need porting. Save IDs and wallet logic can remain stable behind a narrow command interface. Unity does not automatically remove placement searches or first-use asset and shader work.

### Godot

Godot's Mobile renderer targets newer mobile hardware through Vulkan/Metal-capable rendering, while Compatibility targets a wider device range. Select a renderer against the minimum phones we intend to support. Godot uses the MIT license. [Renderer selection](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html), [license](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html).

Its iOS compilation documentation currently restricts the simulator to Compatibility, so choosing Godot does not guarantee simulator parity with a Mobile-renderer device build. Android embedding is documented, but that does not prove a drop-in React Native room view on both platforms. Establish the iOS hosting/lifecycle path before choosing an embedded design. [iOS compilation](https://docs.godotengine.org/en/stable/engine_details/development/compiling/compiling_for_ios.html), [Android embedding guide](https://docs.godotengine.org/en/latest/tutorials/platform/android/embedding_in_android_projects.html). The Android link uses the development documentation and must be checked against the selected stable release.

Godot provides background resource requests, but retrieving an unfinished request can still block. Its loading architecture would also need preload and instancing policies. [Background loading](https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html).

### Three.js and WebGPU

React Native WebGPU uses Dawn and provides Expo examples for raw WebGPU, Three.js and React Three Fiber on iOS and Android. This is a native GPU binding despite the API's name; requiring no web build does not rule it out. Its simulator configuration disables Metal API Validation to avoid documented Dawn false positives. Test the shipped GLBs, skinning, shadow materials, render thread and supported device range before treating it as a production replacement. [WebGPU project](https://github.com/wcandillon/react-native-webgpu), [Expo integration and simulator configuration](https://wcandillon.github.io/react-native-webgpu/docs/getting-started/expo).

The older R3F native path uses Expo GL. Its own installation guide warns about unreliable OpenGL ES in iOS simulators. Moving there specifically to solve a simulator rendering issue is poorly justified. [R3F native installation](https://r3f.docs.pmnd.rs/getting-started/installation).

Apple-only rendering frameworks would require a different Android implementation. Unreal and low-level custom GPU rendering are outside the initial shortlist because their porting scope offers no demonstrated advantage for these small furnished rooms.

## Recommended implementation order

### First remove avoidable CPU and interface delays

Keep the purchase acknowledgement independent of placement and asset readiness. Commit wallet and ownership immediately; perform auto-placement within a bounded job, preserving the item in inventory when no position fits. Do not add a delay timer or make the button await model loading. Maintain one transaction identity so repeated taps and background completion cannot double-charge or duplicate the item.

Replace the exhaustive sorted-grid search with nearby candidate generation and a cached broad-phase spatial index, then run exact checks only for nearby blockers. Cache floor occupancy and furniture approach locations per layout revision. A time-sliced search must yield between batches; wrapping the same synchronous search in a Promise does not move it off the JS thread. Preserve the existing exact support, snapping and rejection tests.

Keep stable references for untouched room layouts. Subscribe room components to their own layout and relevant clock/cat state; wallet or store feedback changes should not rebuild unrelated geometry. The store already uses FlatList, so profile its visible card commits before replacing its list library. Coalesce redundant persistence writes only if I/O traces justify it; save serialization was small in these fixtures.

### Then make models reusable and loading incremental

Retain a long-lived Filament engine with room entity groups or separate native scenes, and render only the visible room. A single `FilamentScene` hoisted around the current JSX is insufficient: the wrapper owns a single scene/view/camera set per engine. Shared-engine rooms need explicit native scene and asset ownership.

Pool models inside that engine. Share geometry and textures, but keep per-instance animation, transforms and mutable lamp/window materials independent. Allocate a small reserve of instances for repeat purchases. Filament's native asset loader supports instances, and its resource loader has incremental asynchronous APIs; the current wrapper path does not expose the complete lifecycle needed here. [Filament resource loader](https://github.com/google/filament/blob/main/libs/gltfio/include/gltfio/ResourceLoader.h). The installed `gltfio/AssetLoader.h` documents recycling instances and the need to retain source data until instance creation is complete.

Warm all four furnished rooms and the active cat before removing the startup cover. Warm visible store models when their category or preview opens, before purchase. Cache bundled bytes separately from parsed/GPU assets. Startup loading every unused catalog model into GPU memory should depend on measured memory headroom. Release unused cached assets under memory pressure without evicting the visible room.

Keep static source data only where future instances need it. Animated assets require their retained data under the current integration. Merge stationary mesh parts by compatible materials during export where it preserves named hinges, lamp heads, glass, animation and picking. Measure draw calls first; mesh count alone is not a frame-time measurement.

### Finally evaluate engine migration against device results

Use release builds on physical iOS and Android devices. Development mode and simulator scheduling are useful for diagnosis but unsuitable for the final speed comparison. React Native explicitly recommends release-build performance testing. [React Native performance](https://reactnative.dev/docs/performance).

| Measurement | Proposed acceptance target |
| --- | --- |
| Purchase button to visible ownership/coin feedback | p95 below 100 ms |
| Prepared room switch to first correct presented frame | p95 below 100 ms; target one or two display frames |
| Purchase of a warmed model to visible placed item | p95 below 100 ms |
| New model loading | No blocked UI interval above 50 ms; measure first-use latency separately |
| 60 Hz interaction | 16.7 ms frame budget; report p95 frame time and longest stalls |
| Night room switch | Correct lighting and saved lamp power on the first presented frame |
| Repeated use | No monotonic memory growth after 100 switches and repeated add/remove cycles |

These are goals, not results. Profile an older supported iPhone, a midrange Android device and a current phone. Include crowded kitchens, moving cat, two casting lamps, zoom/pan, purchases from both cards and previews, background/resume, memory pressure and a ten-minute thermal run. Compare shadows off, directional only and directional plus two lamps.

Record separate timestamps for input, local commit, React commit, placement completion, asset bytes ready, native resource completion and first presentation. Capture CPU, GPU, memory, draw calls and asset reload counts using Instruments/Metal and Android system/GPU tools. A render-callback count alone cannot identify the slow stage.

An alternative earns migration consideration only if it passes the same save/placement/interaction cases, produces correct iOS/Android shadows, and improves the measured bottleneck without an unacceptable startup, memory or battery cost. If physical shadows work and CPU/loading changes meet the targets, keep Filament. If a minimal physical-device rendering defect persists, or the native binding costs become larger than porting one room, compare Babylon Native and Unity prototypes. Choose Godot when the broader goal includes rebuilding the game around its editor and scene system.

## Implemented performance changes

The follow-up implementation keeps React Native and Filament. Automatic item placement indexes nearby structural collision boxes, stops on the first exact collision, and yields after approximately 4 ms of candidate work. It retains the nearest-candidate policy and exact rotated collision, support, wall, and snapping checks. Placement begins after a rendering opportunity for purchase feedback. Canceling or hiding a room aborts its job; unfinished purchases remain queued. Each fitting mutation waits for the updated room blockers before another purchase is fitted. A full room still keeps the purchase in inventory.

World construction scans available floor positions once per build and reuses them across furniture approach and cat-home repairs. Its cache is local to that build, so later physics or editing cannot use stale obstacles. Unchanged layer order and world-clock references are retained, reducing unnecessary room/light updates. Filament frame subscriptions now update their callback through a shared value without repeatedly removing the listener or starting a hidden room's choreographer.

Bundled model bytes are shared across engines through a 32 MiB LRU cache. Every consumer gets its own native holder; releasing a model or evicting cached bytes cannot invalidate another room. Cache masters are released on memory warnings. The native binding exposes gltfio's incremental resource loader. Jobs serialize per engine, retain the engine and source buffer until completion, allow render work between resource updates, cancel failed loads, and recover the queue afterward. Asset parsing and individual native resource updates still have synchronous work; this does not promise a fixed maximum GPU stall.

Opening a store preview prepares a fresh, unmodified model in its destination home engine. A subsequent single-instance purchase claims that prepared asset, avoiding another home-engine decode. Later purchases have independent assets and mutable materials. Each engine keeps at most two unclaimed prepared models and clears them on memory warnings or scene teardown. Buying directly from a card without opening its preview still performs a first-use load. The four room engines remain independent; GPU geometry is not shared across rooms, and the entire unused store catalog is not loaded into GPU memory.

The native changes are reproducible through `postinstall`, pinned to wrapper 1.11.0, and require rebuilding the native client. An older development client uses the original loading methods until rebuilt.

### Recorded CPU results

Same synthetic fixtures and desktop Node/VM benchmark as the baseline, Apple M1 Max. Values are median milliseconds. These exclude React, Hermes, file I/O, native parsing, GPU upload/rendering, and persistence I/O; they are not phone interaction latency measurements.

| Objects per room | Four worlds before | Four worlds after | Island placement before | Island placement after |
| --- | ---: | ---: | ---: | ---: |
| 10 | 26.529 | 7.629 | 2.532 | 0.067 |
| 30 | 295.469 | 18.883 | 307.368 | 4.349 |
| 60 | 849.727 | 35.652 | 2430.756 | 19.163 |

Raw results: [baseline](benchmarks/room-loading-2026-10-11.json), [optimized](benchmarks/room-loading-2026-10-11-optimized.json). Run `node scripts/benchmark-room-loading.mjs` to repeat the CPU study. The performance/lifecycle checks are part of `npm run test:game`.

### Simulator shadows and remaining validation

On the iOS 27 simulator, temporarily enabling shadow maps with PCF still made the furnished kitchen too dark at the daytime preset. A VSM build launched but exited before reaching the room; the available log did not establish its cause. Neither experiment justifies enabling those modes. Both temporary changes were removed, and the normal DPCF/device policy with simulator soft contact shadows was rebuilt and restored. Cast shadows on physical iOS and Android remain enabled. This pass does not resolve Filament's simulator shadow-map defect.

iOS simulator and Android debug native builds compile the new bindings. JavaScript regression checks cover exact placement, deferred feedback, cancellation, rapid purchases, unchanged save anchors, paused/retained rooms, source-buffer ownership, memory pressure, independent prepared assets, decode failure recovery, and scene teardown. The live simulator checks cover startup, furnished rendering, nighttime room browsing, and store model previews; they do not measure the first presented frame.

Physical-device release profiling, p95 input-to-presentation timing, GPU memory and thermal measurements remain unperformed. The acceptance targets above remain targets. A shared-engine architecture or alternative engine should be judged against those device measurements; neither has been implemented or claimed faster in this pass.

### Startup crash and room-switch follow-up (2026-10-11)

Repeated cold launches reproduced a fatal `Max heap size was exceeded` error. A native thread sample showed the JavaScript thread continually inserting placement-grid cells; the process had reached a 2 GB footprint. The first room render has zero viewport width, so screen-sized furniture temporarily occupies enormous world-space bounds. The spatial index was allocating millions of cells before layout. This was a Hermes heap failure, rather than a confirmed Metal shader compiler failure. Grid insertion and queries now have a 256-cell limit per box, with exact collision checks against unindexed obstacles. Regression checks exercise the actual zero-width world and oversized blockers. All four rooms remain mounted and prepared.

A live Hermes CPU profile of warmed kitchen/living-room switches also showed expensive native shared-array pushes during drawing callback registration. Callback updates now keep their registration and update a small shared holder; unmount invalidates the holder before removing it. Furniture drawing callbacks capture their own model metadata instead of the entire 379-item placement catalog. This removes unnecessary catalog copies when pausing and resuming a room.

Temporary probes measured the interval from the room-switch handler to the destination's first drawing callback in the iPhone 18 Pro / iOS 27 debug simulator: living room 317 ms, kitchen 245 ms, repeated kitchen entry 243 ms. These are three observations, not a physical-device p95 or a GPU presentation measurement. Probes were removed afterward. Cold launch, furnished rendering and repeated room switches were checked in the live simulator.

The circular runtime import between room activities and native room geometry was removed by extracting their shared coordinate projection. The pet-stat ring uses Skia's current PathBuilder API. Filament resource release uses a bounded idle callback followed by a timer instead of deprecated InteractionManager scheduling. Cleanup error reporting also accepts native string errors without replacing them with a secondary TypeError. Tests cover callback updates, stale frames after removal, deferred release and preservation of native error messages.
