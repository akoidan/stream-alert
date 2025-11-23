const esbuild = require('esbuild');
const {resolve} = require('path');


esbuild.build({
  entryPoints: [resolve(__dirname, 'dist', 'sea.js')],
  bundle: true,
  outfile: resolve(__dirname,  'dist', 'sea-bundle.js'),
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: [
    'fs', 'path', 'process', 'node:process', 'node:fs', 'node:readline', 'node:module',
    'http', 'https', 'url', 'util', 'stream', 'crypto', 'zlib', 'net', 'tls', 'dns',
    'async_hooks', 'querystring', 'events', 'buffer', 'child_process', 'cluster',
    'dgram', 'inspector', 'module', 'os', 'perf_hooks', 'readline', 'repl',
    'string_decoder', 'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads',
    // Externalize optional NestJS packages, nestjs does () => require('dependency')
    // which confuses esbuild trying to resolve it
    '@nestjs/websockets', '@nestjs/microservices', '@nestjs/websockets/socket-module',
    '@nestjs/microservices/microservices-module', 'class-validator', 'class-transformer',
    '@nestjs/platform-express', '@nestjs/config', 'bindings', 'node-ts-config'
  ],
  plugins: [
    {
      name: 'alias-plugin',
      setup(build) {
        build.onResolve({filter: /^@\/(.*)$/}, (args) => {
          const path = args.path.slice(2); // Remove '@/' 
          return {path: resolve(__dirname, 'dist', path + '.js')};
        });
      },
    },
  ],
  logLevel: 'info'
}).catch(() => process.exit(1));
