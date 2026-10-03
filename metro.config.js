const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Editable source scenes and individual render frames are not runtime assets.
config.resolver.blockList = [/assets\/3d\/frames\/.*/, /assets\/3d\/blender\/.*/, /\.blend\d?$/];
module.exports = config;
