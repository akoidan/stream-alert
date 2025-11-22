const { resolve, join } = require('path');
const { readFileSync, mkdirSync, existsSync } = require('fs');
const { cpSync } = require('fs');

const copiedModules = new Set();
const nodeModulesDir = resolve(__dirname, 'node_modules');
const distNodeModulesDir = resolve(__dirname, 'dist', 'node_modules');

// Ensure dist/node_modules exists
if (!existsSync(distNodeModulesDir)) {
  mkdirSync(distNodeModulesDir, { recursive: true });
}

// Function to copy a module and ALL its dependencies recursively
function copyModule(moduleName) {
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

// Direct dependencies from your source code analysis
const directDependencies = [
  '@nestjs/core',
  '@nestjs/common', 
  'cli-color',
  'telegraf',
  'node-ts-config',
  'bindings'
];

console.log('Copying dependencies...');
directDependencies.forEach(copyModule);
console.log('Dependency copying completed!');
