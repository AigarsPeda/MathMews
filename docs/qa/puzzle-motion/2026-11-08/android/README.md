# Android puzzle motion check — 2026-11-08

Follow-up: both native causes were addressed and retested. See [the fix and verification record](../android-fix/README.md).

**Functional run passed. Smoothness remains inconclusive.** No product code was changed for this check.

Android 16 / API 36, disposable Pixel 9 AVD, 1080 × 2424, native ARM64 debug client, Metro on a dedicated port. A temporary copy of `scripts/native/puzzle-replay/fixture.tsx` rendered the production PlayScreen and result sheets with in-memory replay progress. Its DevSettings fast-refresh call was restricted to iOS; the fixture was removed after testing. No player save was used for puzzle answers.

Four consecutive changes covered a chart, prices, a clock, geometry and capacity. Native UI checks verified each next question, cleared selection, disabled Check answer, stable progress-bar bounds and stable answer-dock bounds. The software-rendered run had no native crash. Progress advanced cumulatively through 10%, 20%, 30% and 40%. Recordings contain intermediate fill widths and slide/fade frames.

The recordings do **not** establish smooth Android-device performance. SwiftShader produced substantial frame drops (for example, one main-window gfxinfo sample reported 39 janky frames out of 40). The videos have variable frame timing and include native result-sheet animations, UI-automation overhead and screen recording. Cropped frame samples are observations, not FPS measurements; zero green width while the native sheet covers the bar is not a progress reset.

A rerun with host graphics confirmed Apple M1 Max / Metal rendering, but did not complete reliably. One attempt showed a blank play area after Next puzzle; subsequent attempts had startup/loading and automation instability. A development reload then crashed with SIGSEGV in React Native `MountingCoordinator::pullTransaction`. The cause was not isolated, and these symptoms must not be attributed to the emulator or to the puzzle animations without further reproduction. The native crash log and blank-screen capture are preserved in `hardware-renderer/`.

`results.json` separates passing functional checks from inconclusive smoothness. `software-renderer/` contains four recordings, frame samples, screenshots and gfxinfo dumps. MP4 recordings are local QA artifacts and are ignored by git. `software-renderer/frame-overview.png` shows the first transition. Debug controls and the floating Expo gear belong to the test client.

Remaining verification: reproduce in a clean Android client and measure on a physical Android device, including repeated Next puzzle transitions. A release-profile/device pass is needed before marking smoothness passed. No speculative animation or native-library change was made from these mixed emulator results.

Targeted regression checks passed: `node scripts/check-puzzle-progress.mjs` and `npm run test:result-dismissal`.
