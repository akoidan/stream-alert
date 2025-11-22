import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { cpSync } from 'fs';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    ssrTarget: 'node',
    rollupOptions: {
      input: resolve(__dirname, 'src/main-vite.ts'),
      external: ['fs', 'path', 'process', 'http', 'https', 'url', 'util', 'stream',
                'crypto', 'zlib', 'net', 'tls', 'dns', 'async_hooks', 'querystring',
                'events', 'buffer', 'child_process', 'cluster', 'dgram', 'inspector',
                'module', 'os', 'perf_hooks', 'readline', 'repl', 'string_decoder',
                'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads',
                /^node:/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'cjs',
        interop: 'auto'
      },
      plugins: [
        {
          name: 'copy-required-dependencies',
          generateBundle(options, bundle) {
            const copiedModules = new Set<string>();
            const nodeModulesDir = resolve(__dirname, 'node_modules');
            const distNodeModulesDir = resolve(__dirname, 'dist', 'node_modules');

            // Ensure dist/node_modules exists
            if (!existsSync(distNodeModulesDir)) {
              mkdirSync(distNodeModulesDir, { recursive: true });
            }

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

            // Function to copy a module and ALL its dependencies recursively
            function copyModule(moduleName: string) {
              if (copiedModules.has(moduleName)) return;
              copiedModules.add(moduleName);

              try {
                const moduleDir = join(nodeModulesDir, moduleName);
                if (!existsSync(moduleDir)) return;

                const distModuleDir = join(distNodeModulesDir, moduleName);

                // Copy the entire module directory WITHOUT modifying
                cpSync(moduleDir, distModuleDir, { recursive: true });
                console.log(`Copied module: ${moduleName}`);

                // Read package.json and copy ALL dependencies recursively
                const packageJsonPath = join(moduleDir, 'package.json');
                if (existsSync(packageJsonPath)) {
                  try {
                    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

                    // Copy dependencies
                    if (packageJson.dependencies) {
                      Object.keys(packageJson.dependencies).forEach(dep => {
                        copyModule(dep);
                      });
                    }

                    // Copy peer dependencies
                    if (packageJson.peerDependencies) {
                      Object.keys(packageJson.peerDependencies).forEach(dep => {
                        copyModule(dep);
                      });
                    }
                  } catch (e) {
                    // Skip if package.json is invalid
                  }
                }
              } catch (error) {
                console.warn(`Warning: Could not copy module ${moduleName}:`, error);
              }
            }

            // Get all imported modules from Rollup's module info
            const moduleIds = this.getModuleIds();
            moduleIds.forEach(moduleId => {
              // Skip relative imports and built-in modules
              if (typeof moduleId === 'string' &&
                  !moduleId.startsWith('./') &&
                  !moduleId.startsWith('../') &&
                  !moduleId.startsWith('\0') &&
                  !moduleId.startsWith('node:') &&
                  !['fs', 'path', 'process', 'http', 'https', 'url', 'util', 'stream',
                    'crypto', 'zlib', 'net', 'tls', 'dns', 'async_hooks', 'querystring',
                    'events', 'buffer', 'child_process', 'cluster', 'dgram', 'inspector',
                    'module', 'os', 'perf_hooks', 'readline', 'repl', 'string_decoder',
                    'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads'].includes(moduleId)) {

                // Extract module name from path (remove subpaths)
                const moduleName = moduleId.split('/')[0];
                if (moduleName) {
                  copyModule(moduleName);
                }
              }
            });
          }
        }
      ]
    },
    minify: false,
    sourcemap: false,
    ssr: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
