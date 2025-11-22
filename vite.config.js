"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const path_1 = require("path");
const fs_1 = require("fs");
const fs_2 = require("fs");
exports.default = (0, vite_1.defineConfig)({
    build: {
        target: 'node18',
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: (0, path_1.resolve)(__dirname, 'src/main.ts')
            },
            plugins: [
                {
                    name: 'copy-required-dependencies',
                    generateBundle(options, bundle) {
                        const copiedModules = new Set();
                        const nodeModulesDir = (0, path_1.resolve)(__dirname, 'node_modules');
                        const distNodeModulesDir = (0, path_1.resolve)(__dirname, 'dist', 'node_modules');
                        // Ensure dist/node_modules exists
                        if (!(0, fs_1.existsSync)(distNodeModulesDir)) {
                            (0, fs_1.mkdirSync)(distNodeModulesDir, { recursive: true });
                        }
                        // Function to copy a module (but not its dependencies)
                        function copyModule(moduleName) {
                            if (copiedModules.has(moduleName))
                                return;
                            copiedModules.add(moduleName);
                            try {
                                const moduleDir = (0, path_1.join)(nodeModulesDir, moduleName);
                                if (!(0, fs_1.existsSync)(moduleDir))
                                    return;
                                const distModuleDir = (0, path_1.join)(distNodeModulesDir, moduleName);
                                // Copy the entire module directory
                                (0, fs_2.cpSync)(moduleDir, distModuleDir, { recursive: true });
                                console.log(`Copied module: ${moduleName}`);
                            }
                            catch (error) {
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
                },
                {
                    name: 'convert-esm-to-cjs',
                    writeBundle() {
                        const distDir = (0, path_1.resolve)(__dirname, 'dist');
                        // Convert all .js files from ES modules to CommonJS
                        function convertEsModulesToCjs(dir) {
                            const items = require('fs').readdirSync(dir);
                            items.forEach(item => {
                                const fullPath = (0, path_1.join)(dir, item);
                                const stat = require('fs').statSync(fullPath);
                                if (stat.isDirectory()) {
                                    convertEsModulesToCjs(fullPath);
                                }
                                else if (item.endsWith('.js')) {
                                    let content = require('fs').readFileSync(fullPath, 'utf-8');
                                    // Convert export statements to module.exports
                                    content = content.replace(/export\s+{\s*([^}]+)\s*}/g, 'module.exports = { $1 }');
                                    content = content.replace(/export\s+default\s+([^;]+)/g, 'module.exports = $1');
                                    content = content.replace(/export\s+const\s+(\w+)/g, 'const $1');
                                    content = content.replace(/export\s+function\s+(\w+)/g, 'function $1');
                                    content = content.replace(/export\s+class\s+(\w+)/g, 'class $1');
                                    // Convert import statements to require
                                    content = content.replace(/import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g, 'const { $1 } = require("$2")');
                                    content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")');
                                    content = content.replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")');
                                    // Add module.exports for individual exports if needed
                                    const lines = content.split('\n');
                                    const exportsToAdd = [];
                                    lines.forEach((line, index) => {
                                        if (line.match(/^(const|function|class)\s+(\w+)/)) {
                                            const match = line.match(/^(const|function|class)\s+(\w+)/);
                                            if (match && match[2]) {
                                                exportsToAdd.push(`module.exports.${match[2]} = ${match[2]};`);
                                            }
                                        }
                                    });
                                    if (exportsToAdd.length > 0 && !content.includes('module.exports = {')) {
                                        content += '\n' + exportsToAdd.join('\n') + '\n';
                                    }
                                    require('fs').writeFileSync(fullPath, content);
                                    console.log(`Converted to CJS: ${item}`);
                                }
                            });
                        }
                        convertEsModulesToCjs(distDir);
                    }
                }
            ]
        },
        output: {
            entryFileNames: '[name].js',
            chunkFileNames: (chunkInfo) => {
                // Create separate files for each source module
                if (chunkInfo.moduleId) {
                    const path = chunkInfo.moduleId;
                    if (path.includes('src/')) {
                        // Convert src/path/file.ts -> path/file.js
                        return path.replace(/.*\/src\//, '').replace(/\.(ts|js)$/, '') + '.js';
                    }
                }
                return '[name].js';
            },
            assetFileNames: '[name].[ext]',
            format: 'es',
            manualChunks: (id) => {
                // Create separate chunks for each source file
                if (id.includes('src/')) {
                    // Return a unique identifier for each file
                    return id.replace(/.*\/src\//, '').replace(/\.(ts|js)$/, '');
                }
                return null; // Let other modules be bundled normally
            }
        },
        minify: false,
        sourcemap: false,
        ssr: true
    },
    resolve: {
        alias: {
            '@': (0, path_1.resolve)(__dirname, 'src')
        }
    }
});
