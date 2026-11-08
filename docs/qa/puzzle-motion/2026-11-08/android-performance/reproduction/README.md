# Reproduction notes

These are archived local test sources, not production modules. Python scripts assume this workspace path, the local Android SDK and a disposable Android 16/API 36 host-GPU AVD named `BrainPet_Motion_Perf_QA` on port 5580. Change the local constants when reproducing elsewhere. Install `uiautomator2` and Pillow in an isolated Python environment. Do not use a player AVD.

For A/B runs, temporarily restore `android-motion-qa.tsx.txt` to `app/android-motion-qa.tsx` and each `qa-before-*.tsx.txt` to `scripts/native/puzzle-motion/` with the final `.txt` removed. Build an optimized arm64 Android release, verify the source map matches the intended sources, and install it only in the disposable AVD. This route is deliberately enabled in the measured release fixture. Never distribute that QA APK.

Run `android-ab.py` without screen recording. It checks AVD identity, alternates bar batches, and tests real production puzzle/result interactions using an in-memory replay save. `capture.py` records normal and reduced motion separately. `no-poll.py` injects a raw ADB tap and waits seven seconds without accessibility polling after that tap. `summarize.py EVIDENCE_DIRECTORY` summarizes callback intervals and native deadline counters. `draw-stages.py EVIDENCE_DIRECTORY` extracts the stages of each slowest recorded native entry frame.

Remove all restored fixture modules, quarantine the QA APK, build a clean production release and check the source map has no QA sources. `production-start.py` checks that onboarding/home has actually painted above the splash, rather than relying only on accessibility nodes behind the splash. Restore the disposable AVD's animation scales to 1, shut it down and delete it when finished.
