const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    blocklist: [
      /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
    ],
  },
};
