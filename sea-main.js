const { createRequire } = require('module');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt user for input
function prompt(question, defaultValue = null) {
  return new Promise((resolve) => {
    const promptText = defaultValue !== null 
      ? `${question} (default: ${defaultValue}): `
      : `${question}: `;
    
    rl.question(promptText, (answer) => {
      if (answer.trim() === '' && defaultValue !== null) {
        resolve(defaultValue);
      } else {
        resolve(answer.trim());
      }
    });
  });
}

// Helper function to validate and convert input
function validateAndConvert(value, type, fieldName) {
  switch (type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`${fieldName} must be a valid number`);
      }
      return num;
    case 'string':
      if (!value || value.trim() === '') {
        throw new Error(`${fieldName} cannot be empty`);
      }
      return value;
    default:
      return value;
  }
}

// Helper function to check if value is from environment variable marker
function isEnvVariable(value) {
  return typeof value === 'string' && value.startsWith('@@');
}

// Main configuration function
async function configureApp() {
  console.log('🔧 Stream Alert Configuration');
  console.log('================================\n');

  // Load configuration directly from file
  let config;
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } else {
      throw new Error('Configuration file not found');
    }
  } catch (error) {
    console.error('Failed to load configuration:', error.message);
    process.exit(1);
  }

  // Configure Telegram section
  console.log('📱 Telegram Configuration');
  console.log('--------------------------');
  
  const telegramToken = isEnvVariable(config.telegram.token) 
    ? await prompt('Telegram bot token')
    : await prompt('Telegram bot token', config.telegram.token);
  config.telegram.token = validateAndConvert(telegramToken, 'string', 'Telegram token');

  const telegramChatId = isEnvVariable(config.telegram.chatId)
    ? await prompt('Telegram chat ID')
    : await prompt('Telegram chat ID', config.telegram.chatId.toString());
  config.telegram.chatId = validateAndConvert(telegramChatId, 'number', 'Telegram chat ID');

  const telegramSpamDelay = isEnvVariable(config.telegram.spamDelay)
    ? await prompt('Spam delay in milliseconds')
    : await prompt('Spam delay in milliseconds', config.telegram.spamDelay.toString());
  config.telegram.spamDelay = validateAndConvert(telegramSpamDelay, 'number', 'Spam delay');

  const telegramMessage = isEnvVariable(config.telegram.message)
    ? await prompt('Default message for alerts')
    : await prompt('Default message for alerts', config.telegram.message);
  config.telegram.message = validateAndConvert(telegramMessage, 'string', 'Telegram message');

  console.log('');

  // Configure Camera section
  console.log('📷 Camera Configuration');
  console.log('------------------------');
  
  const cameraName = isEnvVariable(config.camera.name)
    ? await prompt('Camera name')
    : await prompt('Camera name', config.camera.name);
  config.camera.name = validateAndConvert(cameraName, 'string', 'Camera name');

  const cameraFrameRate = isEnvVariable(config.camera.frameRate)
    ? await prompt('Frame rate (frames per second)')
    : await prompt('Frame rate (frames per second)', config.camera.frameRate.toString());
  config.camera.frameRate = validateAndConvert(cameraFrameRate, 'number', 'Frame rate');

  console.log('');

  // Configure Diff section
  console.log('🔍 Motion Detection Configuration');
  console.log('----------------------------------');
  
  const diffPixels = isEnvVariable(config.diff.pixels)
    ? await prompt('Minimum pixels changed to trigger detection')
    : await prompt('Minimum pixels changed to trigger detection', config.diff.pixels.toString());
  config.diff.pixels = validateAndConvert(diffPixels, 'number', 'Diff pixels');

  const diffThreshold = isEnvVariable(config.diff.threshold)
    ? await prompt('Threshold for pixel changes (0.0 - 1.0)')
    : await prompt('Threshold for pixel changes (0.0 - 1.0)', config.diff.threshold.toString());
  const threshold = validateAndConvert(diffThreshold, 'number', 'Diff threshold');
  if (threshold < 0 || threshold > 1) {
    throw new Error('Diff threshold must be between 0.0 and 1.0');
  }
  config.diff.threshold = threshold;

  console.log('\n✅ Configuration completed successfully!');
  console.log('Starting application...\n');
  
  rl.close();
}

// Run configuration and then start the app
configureApp()
  .then(() => {
    // Change to the dist directory so relative imports work
    process.chdir(path.join(__dirname, 'dist'));
    
    // Load the actual main application using the asset-aware require
    const requireFromAssets = createRequire(path.join(__dirname, 'dist', 'main.js'));
    try {
      requireFromAssets('./main.js');
    } catch (error) {
      console.error('Failed to load main application:', error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Configuration error:', error.message);
    rl.close();
    process.exit(1);
  });
