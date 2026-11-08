# Android blank-screen and crash follow-up

Both native fixes passed the final Android checks. The permanent changes are two guarded dependency backports run by `postinstall`, plus focused native/JS regression tests. No puzzle-flow delay or visual redesign was added.

## Causes and fixes

The saved crash's exact React Native library Build ID is `e59970ac57f947b8fe2e1ffcdcc218fa16367ed2`. Disassembly places `MountingCoordinator::pullTransaction+524` at the virtual call to `shouldOverridePullTransaction()`. Screens 4.26.2 lazily initializes its listener from two startup threads without synchronization. That can corrupt the shared pointer and jump into heap memory. [Upstream fix 4413](https://github.com/software-mansion/react-native-screens/pull/4413) removes that race, synchronizes installation/invalidation and makes stale teardown harmless. The four-file backport is verified against exact source hashes and included in rebuilt native binaries.

The optimized retest exposed a separate animation-state bug. After the result sheet, later scrolling/typing could leave the progress track empty even though accessibility correctly reported two completed puzzles. `release-before-settled-fix/failure.png` preserves that state. Reanimated 4.5.1 evicted old animated values before React received them; a later commit could restore initial width or opacity. Its nested-view collector could also stop syncing because duplicate unregisters decremented a separate counter. [Upstream fix 9527](https://github.com/software-mansion/react-native-reanimated/pull/9527) preserves unsynced values, refreshes stale snapshots, and uses the actual view map size. These five runtime-file changes were backported without changing JSI method signatures. This fixes the mechanism that can reset width to zero or opacity to zero. The original persistent blank screen did not recur in the final tests.

## Verification

The disposable Pixel 9 emulator ran Android 16 / API 36 at 1080 × 2424 with host GPU acceleration through Apple M1 Max / Metal. All system animation scales were set to 1 for the final optimized run.

- Ten developer-client cold launches passed with the screen-listener fix. Each launch proved React executed and the process survived its first native commits. A preliminary attempt while the release build was saturating the host timed out waiting for React; it later initialized and had no native crash. That incomplete attempt is kept separately.
- Three final optimized cold launches passed with both fixes. The destination actually painted, the same process survived, and no app crash was logged.
- Four consecutive optimized puzzle changes passed, covering chart, money entry, clock entry, geometry and capacity. Native UI and screenshot checks confirmed the next question was painted, answers cleared, Check answer disabled, and header/dock bounds stable.
- Pixel checks before every answer and after typing verified cumulative progress after a three-second idle, beyond the old eviction threshold. The clock case included scrolling to the keypad. Final completion widths were 10%, 20%, 30% and 40%.
- Native listener regression compiled the real patched methods with address/undefined-behavior sanitizers and exercised concurrent initialization, 16,000 install/pull/clear cycles, stale teardown, callback collection and reentrant clearing. Clean-install, repeat-install and source-drift guard tests passed.
- Animation registry regression compiled the real patched C++ methods and verified delayed synchronization, re-animation, one sync before eviction and tag cleanup. The real JS collector passed duplicate unregister/restart and React-sync checks. Progress and result-dismissal regressions also passed.

Both debug and optimized release native builds passed. Build/source hashes and counts are in `results.json`; cold-launch records and per-transition geometry are stored alongside it. `pre-fix-crash.txt` preserves the important original crash frames. The `after/` folder is the earlier debug run with the listener fix only.

## Animation review and limits

`release/entry-frames.png` and `release/frame-analysis.json` show the content fading and sliding into place while the header and answer dock remain fixed. Progress recordings contain intermediate widths and retain their final value. Native result-sheet coverage temporarily obscures the bar; a zero pixel count while covered is not a reset.

This is not a physical-device smoothness certification. The emulator still reports frame drops, especially around native result sheets. Main-window gfxinfo in the final clips reported roughly 21–28% janky frames across the entire recorded answer/result/dismissal sequence. The captures and UI automation add overhead, and the metrics do not isolate just the progress animation. The fixes passed correctness and visibility checks; physical Android frame pacing remains unverified.

Early optimized attempts stopped at the clock because the automation tapped a keypad while its scroll fling was still moving. Those are preserved in `release-initial-keypad-run/` and `release-before-settled-fix/`; the latter also exposed the real disappearing progress bug. The final harness waits for the scroll to settle and verifies each typed character. `run-release-motion.py` is the exact final harness and requires the disposable AVD and temporary bundled fixture described below.

## Local test fixture and rebuild requirement

The tests rendered the production PlayScreen and result sheets inside an in-memory replay provider, using a temporary copy of `scripts/native/puzzle-replay/fixture.tsx`. Its Android fast-refresh setter was disabled; its development-only redirect was removed only for the local optimized QA build. The temporary route was removed after testing. The QA release APK was moved out of normal build outputs and must not be distributed. No test route is part of the final source tree.

A new native Android build is required to receive both fixes. Metro reload alone cannot replace these C++ changes. The patched debug APK remains a normal development build; future release builds regenerate their bundle from the cleaned source tree.
