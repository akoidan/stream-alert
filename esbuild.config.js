const esbuild = require('esbuild');
const { resolve } = require('path');
const fs = require('fs');

esbuild.build({
  entryPoints: [resolve(__dirname, 'dist/main.js')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/sea-bundle.js'),
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  banner: {
    js: `
// Fix import.meta for CJS
globalThis.import = globalThis.import || {};
globalThis.import.meta = globalThis.import.meta || { url: 'file://' + __filename };
`
  },
  external: [
    'fs', 'path', 'process', 'node:process', 'node:fs', 'node:readline', 'node:module',
    'http', 'https', 'url', 'util', 'stream', 'crypto', 'zlib', 'net', 'tls', 'dns', 
    'async_hooks', 'querystring', 'events', 'buffer', 'child_process', 'cluster', 
    'dgram', 'inspector', 'module', 'os', 'perf_hooks', 'readline', 'repl', 
    'string_decoder', 'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads',
    // Externalize optional NestJS packages
    '@nestjs/websockets', '@nestjs/microservices', '@nestjs/websockets/socket-module',
    '@nestjs/microservices/microservices-module', 'class-validator', 'class-transformer'
  ],
  logLevel: 'info'
}).then(() => {
  // Copy assets to dist
  const nativeSrc = resolve(__dirname, 'build', 'Debug', 'native.node');
  const nativeDest = resolve(__dirname, 'dist', 'build', 'Debug', 'native.node');
  const configSrc = resolve(__dirname, 'config', 'default.json');
  const configDest = resolve(__dirname, 'dist', 'config', 'default.json');
  
  // Create directories
  fs.mkdirSync(resolve(__dirname, 'dist', 'build', 'Debug'), { recursive: true });
  fs.mkdirSync(resolve(__dirname, 'dist', 'config'), { recursive: true });
  
  // Copy files
  if (fs.existsSync(nativeSrc)) {
    fs.copyFileSync(nativeSrc, nativeDest);
    console.log('Copied native.node');
  }
  if (fs.existsSync(configSrc)) {
    fs.copyFileSync(configSrc, configDest);
    console.log('Copied default.json');
  }
}).catch(() => process.exit(1));
