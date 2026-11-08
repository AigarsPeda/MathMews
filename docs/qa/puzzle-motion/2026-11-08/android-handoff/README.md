# Android result-sheet handoff fix

Filament's listener manager held a mutex while invoking each 3D frame callback. When the result sheet finished closing, React unmounted its cat portrait and synchronously removed its frame listener. That removal could block JavaScript behind a slow native render, preventing the next puzzle from committing for several seconds.

The four-file Filament 1.11.0 patch snapshots owned entries under the list lock and invokes callbacks after unlocking. Cancellation marks an entry inactive without waiting for an in-flight frame. That frame retains its entry until it finishes; canceled subscription tokens retain only weak references. Removal is atomic and idempotent. A separate recursive dispatch lock preserves serialized/reentrant callbacks, and clearing subscriptions keeps the manager itself stable during traversal.

The native sheet still finishes its normal closing animation before navigation. No timer, shortened animation, graphics downgrade or dependency upgrade is retained. The postinstall helper validates the package version and all source hashes. Android must be rebuilt to apply the fix.

## Verification

Optimized release on a disposable Android 16/API 36 arm64 emulator, host GPU, 1080 × 2424. Production puzzle/result/sheet components ran in an in-memory replay fixture with 3D enabled. Timing runs had no frame-callback profiler or screen recording, and no accessibility polling for the first 1.4 seconds after dismissal. Videos were reviewed separately.

| Run | Handoffs | Median close-to-route commit | Maximum |
| --- | ---: | ---: | ---: |
| Original, matched 3D baseline | 4 | 5,082 ms | 5,512 ms |
| Cancellation patch stress run | 15 | 13 ms | 43 ms |
| Final binary with dispatch-order guard | 4 | 17 ms | 25 ms |

All four final-binary cases started and stopped an actual native Filament frame loop. Their new task layouts arrived 45–70 ms after the close promise. The earlier stress run covered 12 ordinary continuations, Android Back, duplicate Next taps and swipe dismissal, plus exiting the result. Progress, cleared answers, scroll reset, normal motion and Reduce Motion passed with no native crashes. Existing result-dismissal checks cover exact path selection and retry behavior.

The native regression reconstructs the original sources and reproduces removal blocking behind a held frame. The patched test checks nonblocking cancellation, callback ownership through an in-flight frame, prompt capture release, serialized/reentrant dispatch, clear, additions during dispatch, concurrent once-only removal, fresh patch installation, idempotence and rejection of changed sources/versions. AddressSanitizer and UndefinedBehaviorSanitizer passed. Recovery, result-dismissal, puzzle-experience, TypeScript and clean release checks also passed.

Run `npm run test:filament-listeners` and, optionally, `python3 scripts/native/check-filament-listeners.py --sanitizers` to reproduce the native regression without an emulator. The clean production source map contains no QA route or timestamp markers, and its Filament binary matches the final measured QA build.

## Limits and cleanup

The multi-second JavaScript handoff lock is fixed. This does not certify every GPU frame at 60 FPS. The earlier stress run included one 408 ms cold emulator GPU/presentation frame and a 419 ms close-to-layout Back case, despite that route committing in 21 ms. Those cold native spikes are not claimed as eliminated. Physical Android frame pacing and iOS runtime pacing were not verified.

Temporary fixtures, recordings, raw traces, rejected experiments, QA APKs and the disposable emulator were removed after verification. Only the fix, regression checks and condensed verification records remain. See `results.json` for measurements and the clean-build check.
