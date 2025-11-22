const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// Generate assets config for production dependencies only
const assets = {
  'dist/**/*': true,
  'config/**/*': true,
  'build/Debug/native.node': true
};

// Add each dependency to assets
dependencies.forEach(dep => {
  assets[`node_modules/${dep}/**/*`] = true;
});

// Create sea-config.json
const seaConfig = {
  main: 'sea-main.js',
  output: 'sea-prep.blob',
  assets: assets
};

fs.writeFileSync('sea-config.json', JSON.stringify(seaConfig, null, 2));
console.log('Generated SEA config with production dependencies only');
console.log('Included dependencies:', dependencies);
