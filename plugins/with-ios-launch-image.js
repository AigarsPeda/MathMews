const fs = require("node:fs/promises");
const path = require("node:path");
const { generateImageAsync } = require("@expo/image-utils");
const { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const LAUNCH_IMAGE_NAME = "MewsLaunch";
const IMAGE_SCALES = [[1, ""], [2, "@2x"], [3, "@3x"]];

// Register before expo-splash-screen so this runs after its Info.plist mod.
module.exports = function withIosLaunchImage(config) {
  config = withInfoPlist(config, (config) => {
    // On the scene-based lifecycle, the system's storyboard snapshot can omit
    // the logo. Use iOS's asset-based launch screen before React starts.
    delete config.modResults.UILaunchStoryboardName;
    config.modResults.UILaunchScreen = {
      UIColorName: "SplashScreenBackground",
      UIImageName: LAUNCH_IMAGE_NAME,
      UIImageRespectsSafeAreaInsets: false,
    };
    // Expo still loads SplashScreen.storyboard by its default name to cover
    // the React root until SplashGate's matching cat and title have painted.
    return config;
  });

  // Bundle ordinary PNGs as well as Expo's catalog image. The system launch
  // renderer can fail to resolve the catalog rendition before the app starts;
  // UIImage(named:) can resolve these files directly from the app bundle.
  config = withDangerousMod(config, ["ios", async (config) => {
    const folder = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName, "LaunchImages");
    await fs.mkdir(folder, { recursive: true });
    for (const [scale, suffix] of IMAGE_SCALES) {
      const { source } = await generateImageAsync(
        { projectRoot: config.modRequest.projectRoot, cacheType: "mews-launch" },
        { src: "./assets/images/splash-launch.png", width: 320 * scale, height: 320 * scale },
      );
      await fs.writeFile(path.join(folder, `${LAUNCH_IMAGE_NAME}${suffix}.png`), source);
    }
    return config;
  }]);

  return withXcodeProject(config, (config) => {
    for (const [, suffix] of IMAGE_SCALES) {
      const filepath = path.join(config.modRequest.projectName, "LaunchImages", `${LAUNCH_IMAGE_NAME}${suffix}.png`);
      if (!config.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName: config.modRequest.projectName, project: config.modResults, isBuildFile: true });
      }
    }
    return config;
  });
};
