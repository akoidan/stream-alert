const { execSync } = require('child_process');
const { resolve } = require('path');
const ts = require('typescript');
const fs = require('fs');

// Read and compile the main TypeScript file
const tsConfig = {
  target: 'ES2020',
  module: 'ESNext', // Keep ES6 imports!
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  skipLibCheck: true,
  baseUrl: '.',
  paths: {
    '@/*': ['src/*']
  },
  moduleResolution: 'node'
};

const mainTsPath = resolve(__dirname, '..', 'src', 'main-vite.ts');
const mainJsPath = resolve(__dirname, '..', 'dist', 'main-vite.js');

// Read TypeScript file
const tsCode = fs.readFileSync(mainTsPath, 'utf-8');

// Replace @ aliases with relative paths before compilation
const processedCode = tsCode.replace(/from ['"]@\/(.+?)['"]/g, (match, path) => {
  return `from '../src/${path}'`;
});

// Compile TypeScript
const result = ts.transpileModule(processedCode, {
  compilerOptions: tsConfig
});

// Write JavaScript file
fs.writeFileSync(mainJsPath, result.outputText);

console.log('TypeScript compilation complete');
