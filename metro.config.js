const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @sqlite.org/sqlite-wasm ships a broken "exports" entry for ./sqlite3.wasm
// (it points at the package root, but the file lives in dist/). Map it explicitly.
const SQLITE_WASM = path.resolve(
  __dirname,
  'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'
);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];
}

const SQLITE_WORKER = path.resolve(
  __dirname,
  'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3-worker1.mjs'
);

const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@sqlite.org/sqlite-wasm/sqlite3.wasm') {
    return { type: 'assetFiles', filePaths: [SQLITE_WASM] };
  }
  // the package spawns this worker with a bare relative specifier
  if (moduleName === 'sqlite3-worker1.mjs') {
    return { type: 'sourceFile', filePath: SQLITE_WORKER };
  }
  if (upstreamResolve) {
    return upstreamResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
