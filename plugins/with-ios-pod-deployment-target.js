const { withPodfile } = require("expo/config-plugins");

module.exports = function withIosPodDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    const marker = "    # Keep resource bundles compatible with the app's minimum iOS version.";
    const anchor = "  post_install do |installer|";
    const contents = config.modResults.contents;

    if (contents.includes(marker)) return config;
    if (!contents.includes(anchor)) {
      throw new Error("Cannot set iOS pod deployment targets: post_install hook is missing.");
    }

    const hook = `${marker}
    minimum_ios_version = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '16.4')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        deployment_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target.nil? || Gem::Version.new(deployment_target) < minimum_ios_version
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios_version.to_s
        end
      end
    end
`;

    config.modResults.contents = contents.replace(anchor, `${anchor}\n${hook}`);
    return config;
  });
};
