module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
    // Reanimated 4 and Filament share the compatible worklet format. Nested
    // callbacks also need transformation for Filament's separate runtime.
    plugins: [['react-native-worklets/plugin', { processNestedWorklets: true }]],
  };
};
