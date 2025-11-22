const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get the Node.js executable path
const nodePath = process.execPath;
const outputExe = 'stream-alert-vite.exe';

// Create a copy of the Node.js executable
console.log('Creating copy of Node.js executable...');
fs.copyFileSync(nodePath, outputExe);

// Inject the SEA blob into the executable
console.log('Injecting SEA blob...');
try {
  execSync(`postject ${outputExe} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
    stdio: 'inherit'
  });
  console.log(`SEA executable created: ${outputExe}`);
} catch (error) {
  console.error('Failed to inject SEA blob:', error.message);
  process.exit(1);
}
