const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the problematic VirtualViewNativeComponent from the bundle
config.resolver.blocklist = [
  ...(config.resolver.blocklist || []),
  /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
];

module.exports = config;
