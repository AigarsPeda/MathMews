/** Exercise the real Expo mod chain and Xcode resource graph in a temp project. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { withPlugins } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const xcode = require('xcode');
const { expo } = JSON.parse(await fs.readFile('app.json', 'utf8'));
const nativePlugins = expo.plugins.filter(spec => {
  const name = Array.isArray(spec) ? spec[0] : spec;
  return name === './plugins/with-ios-launch-image' || name === 'expo-splash-screen';
});
assert.equal(nativePlugins.length, 2, 'Both launch plugins must remain registered');
const plugins = nativePlugins.map(spec => {
  const [name, options] = Array.isArray(spec) ? spec : [spec];
  const plugin = require(name.startsWith('.') ? path.resolve(name) : `${name}/app.plugin.js`);
  return [plugin.default ?? plugin, options];
});

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mews-launch-test-'));
const projectName = 'MathMews';
const ios = path.join(root, 'ios');
const appRoot = path.join(ios, projectName);
const projectFile = path.join(ios, `${projectName}.xcodeproj`, 'project.pbxproj');
try {
  await fs.mkdir(appRoot, { recursive: true });
  await fs.mkdir(path.dirname(projectFile), { recursive: true });
  await fs.mkdir(path.join(root, 'assets/images'), { recursive: true });
  await fs.writeFile(path.join(appRoot, 'AppDelegate.swift'), '// Source-root marker for Expo');
  for (const image of ['splash-brand.png', 'splash-launch.png']) {
    await fs.copyFile(`assets/images/${image}`, path.join(root, 'assets/images', image));
  }

  // A small real Xcode project, with one application and Expo's storyboard
  // phase. No generated ios/ folder, Xcode installation or simulator is needed.
  await fs.writeFile(projectFile, `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 54;
  objects = {
    /* Begin PBXProject section */
    A00000000000000000000001 = { isa = PBXProject; mainGroup = A00000000000000000000002; targets = (A00000000000000000000004 /* MathMews */,); };
    /* End PBXProject section */
    /* Begin PBXGroup section */
    A00000000000000000000002 = { isa = PBXGroup; children = (A00000000000000000000003 /* MathMews */,); sourceTree = "<group>"; };
    A00000000000000000000003 = { isa = PBXGroup; name = MathMews; children = (); sourceTree = "<group>"; };
    /* End PBXGroup section */
    /* Begin PBXNativeTarget section */
    A00000000000000000000004 = { isa = PBXNativeTarget; name = MathMews; productType = "com.apple.product-type.application"; buildPhases = (A00000000000000000000005 /* Resources */,); };
    /* End PBXNativeTarget section */
    /* Begin PBXResourcesBuildPhase section */
    A00000000000000000000005 /* Resources */ = { isa = PBXResourcesBuildPhase; files = (A00000000000000000000007 /* SplashScreen.storyboard in Resources */,); };
    /* End PBXResourcesBuildPhase section */
    /* Begin PBXFileReference section */
    A00000000000000000000006 = { isa = PBXFileReference; path = "MathMews/SplashScreen.storyboard"; sourceTree = "<group>"; };
    /* End PBXFileReference section */
    /* Begin PBXBuildFile section */
    A00000000000000000000007 = { isa = PBXBuildFile; fileRef = A00000000000000000000006; };
    /* End PBXBuildFile section */
  };
  rootObject = A00000000000000000000001;
}
`);

  let priorImageBytes;
  for (let pass = 0; pass < 2; pass++) {
    // Preserve app.json's plugin order. Swapping the plugins must fail the
    // Info.plist assertion because Expo then restores the blank storyboard.
    const config = withPlugins({ ...expo, plugins: undefined, _internal: { projectRoot: process.cwd() } }, plugins);
    const modRequest = { projectRoot: root, platformProjectRoot: ios, projectName, platform: 'ios', introspect: false };
    const plist = await config.mods.ios.infoPlist({ ...config, modRequest, modResults: { UILaunchStoryboardName: 'SplashScreen' } });
    assert.equal(plist.modResults.UILaunchStoryboardName, undefined, 'The launch plugin must run after Expo replaces Info.plist settings');
    assert.deepEqual(plist.modResults.UILaunchScreen, {
      UIColorName: 'SplashScreenBackground', UIImageName: 'MewsLaunch', UIImageRespectsSafeAreaInsets: false,
    }, 'The system launch must use the directly bundled PNG before React starts');

    await config.mods.ios.dangerous({ ...config, modRequest, modResults: {} });
    const project = xcode.project(projectFile);
    project.parseSync();
    await config.mods.ios.xcodeproj({ ...config, modRequest, modResults: project });
    await fs.writeFile(projectFile, project.writeSync());
    assert.ok(project.hasFile(`${projectName}/SplashScreen.storyboard`), 'Expo must retain its matching React-root cover');

    // A file reference alone is insufficient. Follow the application's actual
    // copy phase through PBXBuildFile to PBXFileReference, catching the missing
    // isBuildFile flag that otherwise silently leaves the PNGs out of the app.
    const resources = project.pbxResourcesBuildPhaseObj('A00000000000000000000004').files;
    const buildFiles = project.pbxBuildFileSection();
    const references = project.pbxFileReferenceSection();
    const copiedPaths = resources.map(entry => {
      const reference = buildFiles[entry.value]?.fileRef;
      return references[reference]?.path?.replace(/^"|"$/g, '');
    });
    const imageBytes = [];
    for (const [scale, suffix] of [[1, ''], [2, '@2x'], [3, '@3x']]) {
      const relative = `${projectName}/LaunchImages/MewsLaunch${suffix}.png`;
      assert.equal(copiedPaths.filter(value => value === relative).length, 1, `${relative} must be copied exactly once, including after a second prebuild`);
      const file = path.join(ios, relative);
      const actual = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(actual.info.width, 320 * scale);
      assert.equal(actual.info.height, 320 * scale);
      // Expo may resize with Sharp or Jimp depending on the host. Compare the
      // two native covers after decoding, rather than comparing their encoders.
      const expected = await sharp(path.join(appRoot, 'Images.xcassets/SplashScreenLogo.imageset', `image${suffix}.png`)).ensureAlpha().raw().toBuffer();
      assert.ok(actual.data.equals(expected), 'The system launch PNG and Expo root cover must contain identical artwork at every scale');
      imageBytes.push(await fs.readFile(file));
    }
    if (priorImageBytes) {
      imageBytes.forEach((bytes, index) => assert.ok(bytes.equals(priorImageBytes[index]), 'A repeated prebuild must preserve the launch images'));
    }
    priorImageBytes = imageBytes;
  }
  console.log('Verified real Expo plugin ordering, native launch PNG generation, Xcode resource copying and repeated-prebuild stability.');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

// A correct config does not update a previously generated native project.
// Verify its actual resources when checking a local iOS build.
if (process.argv[2]) {
  const appRoot = path.resolve(process.argv[2]);
  for (const [scale, suffix] of [[1, ''], [2, '@2x'], [3, '@3x']]) {
    const { source } = await generateImageAsync(
      { projectRoot: process.cwd() },
      { src: './assets/images/splash-launch.png', width: 320 * scale, height: 320 * scale },
    );
    const expected = await sharp(source).ensureAlpha().raw().toBuffer();
    for (const relative of [
      `LaunchImages/MewsLaunch${suffix}.png`,
      `Images.xcassets/SplashScreenLogo.imageset/image${suffix}.png`,
    ]) {
      const actual = await sharp(path.join(appRoot, relative)).ensureAlpha().raw().toBuffer();
      assert.ok(actual.equals(expected), `${relative} contains stale launch artwork. Run npm run preios before rebuilding.`);
    }
  }
  console.log('Verified generated native launch resources contain the current splash artwork at every scale.');
}
