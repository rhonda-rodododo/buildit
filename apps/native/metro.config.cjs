const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const appRoot = __dirname;
const monorepoRoot = path.resolve(appRoot, '../..');

// Get Expo's default config
const config = getDefaultConfig(appRoot);

// Configure for monorepo
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(appRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Enable symlinks for bun workspace packages
config.resolver.unstable_enableSymlinks = true;

// Export with NativeWind support
module.exports = withNativeWind(config, { input: './global.css' });
