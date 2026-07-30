module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // NOTE: do not add 'react-native-worklets/plugin' here.
    // babel-preset-expo already injects it automatically when
    // react-native-worklets is installed. Adding it a second time
    // double-transforms worklets and crashes the app on native.
  };
};
