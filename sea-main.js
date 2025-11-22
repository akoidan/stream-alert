const { createRequire } = require('module');
const path = require('path');

// Create a require function that can load modules from the sea-assets directory
const requireFromAssets = createRequire(path.join(__dirname, 'sea-assets', 'main.js'));

// Load the actual main application using the asset-aware require
try {
  // Change to the sea-assets directory so relative imports work
  process.chdir(path.join(__dirname, 'sea-assets'));
  
  // Load the main application
  requireFromAssets('./main.js');
} catch (error) {
  console.error('Failed to load main application:', error);
  process.exit(1);
}
