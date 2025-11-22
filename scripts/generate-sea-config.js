const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = [], includeNodeModules = false) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Only include node_modules if specifically requested
      if (file === 'node_modules' && !includeNodeModules) {
        // Skip node_modules directory entirely
        return;
      }
      getAllFiles(fullPath, arrayOfFiles, includeNodeModules);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function generateSeaConfig(includeNodeModules = false) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('dist folder not found. Run yarn vite first.');
    process.exit(1);
  }

  const allFiles = getAllFiles(distPath, [], includeNodeModules);
  
  // Filter out the main JS file since it goes in the "main" field
  const assetFiles = allFiles.filter(file => !file.endsWith('main-vite.js'));
  
  // Create assets object with relative paths as keys
  const assets = {};
  assetFiles.forEach(file => {
    const relativePath = path.relative(distPath, file).replace(/\\/g, '/');
    assets[relativePath.replace(/\//g, '-').replace(/\./g, '-')] = file;
  });

  const config = {
    main: path.join(distPath, 'main-vite.js'),
    output: 'sea-prep.blob',
    assets: assets
  };

  // Write sea-config.json
  const configPath = path.resolve(__dirname, '..', 'sea-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`Generated sea-config.json with ${Object.keys(assets).length} assets:`);
  if (Object.keys(assets).length <= 10) {
    Object.keys(assets).forEach(key => {
      console.log(`  ${key}: ${assets[key]}`);
    });
  } else {
    console.log('  (Too many assets to list individually)');
    console.log(`  Config file size: ${Math.round(fs.statSync(configPath).size / 1024)}KB`);
  }
}

// Check command line arguments
const includeNodeModules = process.argv.includes('--include-node-modules');
generateSeaConfig(includeNodeModules);
