# Android topic entry verification

Verified on the disposable Android 16/API 36 Pixel 9 emulator with a fresh development APK and the production topic/path screens. No physical device was tested.

The current tile was fully inside the first observed native path viewport for levels 5 and 10, reopening a topic, a 320-point layout, and returning with Android Back after manually scrolling to and opening level 1. Screen recordings show the current tile in place from its first visible frame, with no scroll from the top. Normal manual scrolling remained available. No application crash was recorded.

`results.json` includes viewport/tile bounds, source hashes and the APK hash. `opening-frames.png` and `return-frames.png` sample the native recordings at 200 ms intervals. The temporary fixture used in-memory learning progress on a dedicated emulator and was removed after testing.
