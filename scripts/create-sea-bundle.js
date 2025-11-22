const fs = require('fs');
const path = require('path');

// Create a virtual file system bundle
const bundle = {
  'main.js': fs.readFileSync(path.join(__dirname, '../dist/main.js'), 'utf8'),
  'config/default.json': fs.readFileSync(path.join(__dirname, '../src/config/default.json'), 'utf8'),
  // Add any other files you need
};

// Create a bootstrap that loads from the bundled virtual FS
const bootstrap = `
const virtualFS = ${JSON.stringify(bundle)};
const Module = require('module');
const path = require('path');

// Override require to load from virtual FS
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (virtualFS[id]) {
    const module = new Module(id, this);
    module.filename = id;
    module.exports = {};
    module._compile(virtualFS[id], id);
    return module.exports;
  }
  return originalRequire.apply(this, arguments);
};

// Load the main app
require('./main.js');
`;

fs.writeFileSync(path.join(__dirname, '../sea-bundle.js'), bootstrap);
console.log('SEA bundle created with multiple files');
