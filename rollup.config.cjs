const { resolve } = require('path');
const { readFileSync, mkdirSync, existsSync } = require('fs');
const { cpSync } = require('fs');
const commonjs = require('@rollup/plugin-commonjs');
const nodeResolve = require('@rollup/plugin-node-resolve');

// Asset copying plugin
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    generateBundle(options, bundle) {
      // Copy native.node file
      const nativeNodePath = resolve(__dirname, 'build', 'Debug', 'native.node');
      const distNativeDir = resolve(__dirname, 'dist', 'build', 'Debug');
      if (existsSync(nativeNodePath)) {
        if (!existsSync(distNativeDir)) {
          mkdirSync(distNativeDir, { recursive: true });
        }
        cpSync(nativeNodePath, resolve(distNativeDir, 'native.node'));
        console.log('Copied native.node');
      } else {
        console.warn('Warning: native.node not found at', nativeNodePath);
      }

      // Copy config file
      const configSrcFile = resolve(__dirname, 'src', 'config', 'default.json');
      const configDistDir = resolve(__dirname, 'dist', 'config');
      if (existsSync(configSrcFile)) {
        if (!existsSync(configDistDir)) {
          mkdirSync(configDistDir, { recursive: true });
        }
        cpSync(configSrcFile, resolve(configDistDir, 'default.json'));
        console.log('Copied default.json');
      } else {
        console.warn('Warning: default.json not found at', configSrcFile);
      }
    }
  };
}

module.exports = {
  input: resolve(__dirname, 'dist/main-vite.js'), // Bundle the compiled JS
  context: 'global', // Fix browser context issue
  output: {
    file: resolve(__dirname, 'dist/main-vite-bundled.js'),
    format: 'cjs',
    exports: 'auto'
  },
  external: ['fs', 'path', 'process', 'node:process', 'node:fs', 'node:readline', 'node:module',
            'http', 'https', 'url', 'util', 'stream', 'crypto', 'zlib', 'net', 'tls', 'dns', 
            'async_hooks', 'querystring', 'events', 'buffer', 'child_process', 'cluster', 
            'dgram', 'inspector', 'module', 'os', 'perf_hooks', 'readline', 'repl', 
            'string_decoder', 'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads'], // Keep built-ins external
  plugins: [
    {
      name: 'resolve-relative',
      resolveId(id, importer) {
        // Handle relative imports to src folder
        if (id.startsWith('../src/')) {
          const resolved = resolve(process.cwd(), id.substring(3) + '.ts');
          return resolved;
        }
        return null;
      }
    },
    {
      name: 'json-loader',
      transform(code, id) {
        if (id.endsWith('.json')) {
          const json = JSON.parse(code);
          return {
            code: `export default ${JSON.stringify(json)};`,
            map: null
          };
        }
        return null;
      }
    },
    {
      name: 'typescript-loader',
      transform(code, id) {
        if (id.endsWith('.ts')) {
          const ts = require('typescript');
          const result = ts.transpileModule(code, {
            compilerOptions: {
              target: 'ES2020',
              module: 'ESNext', // Keep ES6 exports!
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              skipLibCheck: true
            }
          });
          return {
            code: result.outputText,
            map: null
          };
        }
        return null;
      }
    },
    nodeResolve({
      preferBuiltins: false, // Don't auto-externalize built-ins
      browser: false // Force Node.js environment
    }),
    commonjs({
      include: /node_modules/
    }),
    copyAssetsPlugin()
  ]
};
