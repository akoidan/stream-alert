const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json to get production dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

console.log('Copying essential production dependencies...');

// Create dist/node_modules if it doesn't exist
if (!fs.existsSync('dist/node_modules')) {
  fs.mkdirSync('dist/node_modules', { recursive: true });
}

dependencies.forEach(dep => {
  const src = `node_modules/${dep}`;
  const dest = `dist/node_modules/${dep}`;
  
  if (fs.existsSync(src)) {
    // Remove existing destination
    if (fs.existsSync(dest)) {
      execSync(`rmdir /s /q "${dest}"`, { stdio: 'inherit' });
    }
    
    // Copy dependency
    execSync(`xcopy "${src}" "${dest}" /E /I /H /Y`, { stdio: 'inherit' });
    console.log(`✓ Copied ${dep}`);
  } else {
    console.warn(`⚠ ${dep} not found in node_modules`);
  }
});

console.log('Dependencies copied to dist/node_modules');
console.log('Now you can run: yarn build');
