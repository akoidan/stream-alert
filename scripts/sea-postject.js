const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Copy native.node to dist
if (fs.existsSync('build/Debug/native.node')) {
  fs.copyFileSync('build/Debug/native.node', 'dist/native.node');
  console.log('Copied native.node to dist');
} else {
  console.error('native.node not found in build/Debug directory');
  process.exit(1);
}

// Remove old executable if it exists
let appExecutable = 'stream-alert.exe';
if (fs.existsSync(appExecutable)) {
  try {
    fs.unlinkSync(appExecutable);
  } catch (error) {
    console.log('Could not remove old executable (file may be in use), using timestamp name');
    // Use a timestamp to create a unique name
    const timestamp = Date.now();
    appExecutable = `stream-alert-${timestamp}.exe`;
  }
}

// Copy Node.js executable to our app name
const nodeExecutable = process.execPath;

try {
  execSync(`copy "${nodeExecutable}" "${appExecutable}"`, { stdio: 'inherit' });
  console.log('Created copy of Node.js executable');
} catch (error) {
  console.error('Failed to copy Node.js executable:', error.message);
  process.exit(1);
}

// Use postject to inject the blob into our copied executable
try {
  // Use yarn to run postject (follows project rules)
  execSync(`yarn postject "${appExecutable}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`, { stdio: 'inherit' });
  console.log('SEA executable created successfully');
} catch (error) {
  console.error('Postject failed:', error.message);
  process.exit(1);
}

console.log('The dist folder contains the bundled assets and should be distributed with the executable');
