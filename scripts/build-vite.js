const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create proper directory structure for native bindings
if (!fs.existsSync('dist-vite/build/Debug')) {
  fs.mkdirSync('dist-vite/build/Debug', { recursive: true });
}

// Copy native.node to dist-vite/build/Debug (where bindings expects it)
if (fs.existsSync('build/Debug/native.node')) {
  fs.copyFileSync('build/Debug/native.node', 'dist-vite/build/Debug/native.node');
  console.log('Copied native.node to dist-vite/build/Debug');
} else {
  console.error('native.node not found in build/Debug directory');
  process.exit(1);
}

// Copy config files
if (!fs.existsSync('dist-vite/config')) {
  fs.mkdirSync('dist-vite/config', { recursive: true });
}
fs.copyFileSync('src/config/default.json', 'dist-vite/config/default.json');
console.log('Copied config files');

// Copy only production dependencies from node_modules
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

if (!fs.existsSync('dist-vite/node_modules')) {
  fs.mkdirSync('dist-vite/node_modules', { recursive: true });
}

dependencies.forEach(dep => {
  const src = `node_modules/${dep}`;
  const dest = `dist-vite/node_modules/${dep}`;
  
  if (fs.existsSync(src)) {
    execSync(`xcopy "${src}" "${dest}" /E /I /H /Y`, { stdio: 'inherit' });
    console.log(`Copied ${dep}`);
  } else {
    console.warn(`${dep} not found in node_modules`);
  }
});

console.log('Vite build completed with dependencies');
