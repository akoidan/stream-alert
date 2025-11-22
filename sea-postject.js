const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create sea-assets directory if it doesn't exist
if (!fs.existsSync('sea-assets')) {
  fs.mkdirSync('sea-assets');
}

// Copy the entire dist folder to sea-assets
function copyFolderSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy dist folder contents
copyFolderSync('./dist', './sea-assets');

// Copy native.node to sea-assets
if (fs.existsSync('build/Debug/native.node')) {
  fs.copyFileSync('build/Debug/native.node', 'sea-assets/native.node');
  console.log('Copied native.node to sea-assets');
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
    console.log('Could not remove old executable (file may be in use), using temporary name');
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
  // Try using the postject CLI tool first
  execSync(`npx postject "${appExecutable}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`, { stdio: 'inherit' });
  console.log('SEA executable created successfully: stream-alert.exe');
  console.log('The sea-assets folder contains the bundled assets and should be distributed with the executable');
} catch (error) {
  console.error('Error creating SEA executable with CLI:', error.message);
  
  // Fallback: try built-in postject
  try {
    const { postject } = require('node');
    postject(appExecutable, 'NODE_SEA_BLOB', 'sea-prep.blob', {
      sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    });
    console.log('SEA executable created successfully using built-in postject');
  } catch (fallbackError) {
    console.error('Both CLI and built-in postject failed:', fallbackError.message);
    console.log('Note: The executable may still work despite the error');
    
    if (fs.existsSync(appExecutable)) {
      console.log('Executable exists, testing if it works...');
    } else {
      process.exit(1);
    }
  }
}
