const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const appRoot = __dirname;
const monorepoRoot = path.resolve(appRoot, '../..');

// Get Expo's default config
const config = getDefaultConfig(appRoot);

// Configure for monorepo with bun workspaces
config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(appRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
  // Bun stores packages in .bun directory
  path.resolve(monorepoRoot, 'node_modules/.bun'),
];

// Enable symlinks for bun workspace packages
config.resolver.unstable_enableSymlinks = true;

// Handle .js extension in imports (some packages import @noble/hashes/sha256.js)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Strip .js extension from @noble and @scure imports for compatibility
  if (moduleName.match(/^@(noble|scure)\/.*\.js$/)) {
    const strippedName = moduleName.replace(/\.js$/, '');
    return context.resolveRequest(context, strippedName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Export with NativeWind support
module.exports = withNativeWind(config, { input: './global.css' });
