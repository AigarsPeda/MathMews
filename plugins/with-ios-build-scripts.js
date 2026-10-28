const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withIosBuildScripts(config) {
  return withXcodeProject(config, (config) => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const configuration of Object.values(configurations)) {
      if (typeof configuration === "object" && configuration.buildSettings) {
        configuration.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
      }
    }
    return config;
  });
};
