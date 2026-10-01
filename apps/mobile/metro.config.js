const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

// Expo 57's DOM export loses shared chunks from Mermaid's diagram imports
// ("Asset not found: __common-*.js"). Keep web/DOM bundles self-contained so
// native release builds include every diagram renderer for offline use.
process.env.EXPO_NO_BUNDLE_SPLITTING = '1';

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: path.join(__dirname, 'src/global.css'),
  configPath: path.join(__dirname, 'tailwind.config.js'),
  projectRoot: __dirname,
});
