# Replay regression checks

The fixtures render the production play screen. `cold-fixture.tsx` uses the outer production GameProvider, save queue and AsyncStorage. It seeds a completed first level before each scenario, then reads the real saved run after process restarts. No replacement memory save is supplied after relaunch.

## Android

Use a disposable emulator whose AVD name is `BrainPet_Replay_QA`, with the current `com.mathmews.app` debug APK installed. The runner refuses other AVDs because it seeds progress. Install `uiautomator2==3.7.1` in an isolated Python environment.

Start a dedicated, file-watching development server from the repository root:

```sh
npx expo start --dev-client --port 8082 --localhost
```

Then run:

```sh
python3 scripts/native/check-android-puzzle-replay.py --device emulator-5580 --port 8082 --output docs/qa/puzzle-replay/2026-11-08/android-3d
```

The runner creates and removes its temporary Expo route, disables Fast Refresh before launch, performs three replay scenarios and five real force-stop/relaunch cycles, inspects the closed app's SQLite save, and writes JSON evidence and native screenshots. It explicitly selects normal 3D and checks the live graphics mode after restarts and task transitions. A further check keeps the home TextureView mounted through three forced garbage collections and a 45-second soak. `--simple-graphics` selects the supported alternate mode and skips the 3D GC check.

The initial Android 16/API 36 run passed in Simple Graphics and exposed an ART SuspendAll timeout in normal 3D. The crash stack resolves to Filament's native condition wait. Its Android frame callback was annotated `@FastNative`, which prevents GC suspension during native execution. Frame callbacks now use normal JNI because their listeners can wait on the renderer. [Android's JNI guidance](https://developer.android.com/ndk/guides/jni-tips#faster_native_calls_with_fastnative_and_criticalnative) explains this restriction. The patch is reapplied by postinstall and only changes Android. Historical results and crash logs remain in `docs/qa/puzzle-replay/2026-11-08/android/`. No physical Android device was tested.

After the fix, the normal 3D run passed all four scenarios, five process restarts, three forced collections and the stability wait without fallback or a native crash. Tasks, answers and original deadlines survived restarts; level 2 stayed open, and closed-app expiry charged one life once. Results, APK hashes, screenshots and GC logs are in `docs/qa/puzzle-replay/2026-11-08/android-3d/`.

## iOS

```sh
node scripts/native/check-puzzle-drag.mjs --replay --device <simulator-UDID>
node scripts/native/check-puzzle-drag.mjs --replay-cold --device <simulator-UDID>
```

The cold suite terminates and relaunches the native application five times, including expiry while the app is closed. Use a disposable simulator.
