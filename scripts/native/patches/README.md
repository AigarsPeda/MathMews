# Native animation backports

`react-native-screens-4.26.2-removal-listener.patch` backports the four-file native fix from [upstream PR 4413](https://github.com/software-mansion/react-native-screens/pull/4413), including its install/invalidate serialization and ownership-token changes. The three upstream commits end at `204d36b45f2a718c6f86e00cfc70765cbde06565`. Only the `cpp/legacy/` paths are relocated to `cpp/`, matching the installed 4.26.2 package.

The installed Expo SDK pins screens to 4.26.x. This backport avoids changing navigation APIs or taking the unrelated changes in screens 4.28.0. `patch-android-screen-listener.mjs` checks the package version and all four source hashes before applying the patch and verifies the resulting hashes. It runs from `postinstall`, including clean native builds, and is safe to run again.

Run `npm run test:android-screen-listener` for the C++ concurrency and callback-lifetime regression checks. Rebuild Android after applying this patch; a Metro reload cannot replace native code.

Upstream code is Copyright (c) 2018 Software Mansion and distributed under the MIT license, included in `node_modules/react-native-screens/LICENSE`.

`react-native-reanimated-4.5.1-settled-props.patch` contains the five runtime-file changes from [upstream PR 9527](https://github.com/software-mansion/react-native-reanimated/pull/9527). The native registry retains animated values until React has received them, invalidates stale snapshots on re-animation and clears metadata on unmount. The JS collector uses its map size so nested animated views cannot stop synchronization through a counter underflow. JSI method names and signatures stay compatible with the installed Worklets version.

The backport excludes upstream documentation and validation for conflicting experimental feature flags. This app keeps `USE_ANIMATION_BACKEND` disabled. `patch-reanimated-settled-props.mjs` verifies all five source hashes before and after installation. Run `node scripts/check-settled-animation-props.mjs` for delayed-sync, re-animation and collector-lifetime regression checks. Rebuild the native app to include the registry fix.

## Filament listener cancellation

`react-native-filament-1.11.0-listeners.patch` is a local fix for the shared listener manager, not an upstream backport. The original manager held its mutex while invoking a frame callback. Detaching a 3D result portrait could therefore block JavaScript on listener removal until a slow native frame finished. The revised manager snapshots owned callback entries under the lock and invokes them after unlocking. Cancellation marks an entry inactive and removes it without waiting for an in-flight callback. That callback retains its own entry until it returns; canceled subscriptions hold only weak references so captures can be released promptly.

Listener removal is atomic and idempotent across concurrent callers. A separate recursive dispatch lock preserves serialized and reentrant callback dispatch without blocking cancellation. `clear()` cancels the existing manager's entries rather than replacing the manager while a frame is traversing it. Reentrant removal, cancellation of a later callback, subscription during dispatch and stale tokens after clearing are covered by native tests.

`patch-filament-listeners.mjs` validates the Filament 1.11.0 version and all four source hashes before and after applying the patch. `patch-filament.mjs` includes it in postinstall. Run `npm run test:filament-listeners`; the test reconstructs the original sources and reproduces their blocking behavior before checking the patched implementation. `python3 scripts/native/check-filament-listeners.py --sanitizers` also checks the patched implementation with AddressSanitizer and UndefinedBehaviorSanitizer.

A native rebuild is required. Upstream code is Copyright (c) 2024 Marc Rousavy under the [MIT license](https://github.com/margelo/react-native-filament/blob/main/LICENSE), copied in `LICENSE-filament`. No timeout or shortened result animation is added.
