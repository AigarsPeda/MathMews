const { withPodfile, withProjectBuildGradle } = require("expo/config-plugins");

// Native allocation traces run every frame. Keep them opt-in for profiling.
module.exports = function withFilamentLogging(config) {
  config = withPodfile(config, (config) => {
    const setting = "$RNFEnableLogs = ENV['FILAMENT_DEBUG_LOGS'] == '1'";
    const contents = config.modResults.contents;
    config.modResults.contents = contents.includes(setting) ? contents : `${setting}\n${contents}`;
    return config;
  });
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("Review Filament logging configuration for the new Gradle format.");
    }
    const setting = 'ext.RNF_enableLogs = System.getenv("FILAMENT_DEBUG_LOGS") == "1"';
    const contents = config.modResults.contents;
    config.modResults.contents = contents.includes(setting) ? contents : `${contents}\n${setting}\n`;
    return config;
  });
};
