import {join} from 'path';
import process from 'node:process';

// Enable file-based require for SEA
if (require('node:sea').isSea()) {
  const { createRequire } = require('node:module');
  (global as any).require = createRequire(__filename);
}

process.env['NODE_CONFIG_TS_DIR'] = join(__dirname, 'config');

import fs from 'fs';
import readline from 'readline';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';
import {NestFactory} from '@nestjs/core';

// Load configuration directly
const configPath = join(process.env.NODE_CONFIG_TS_DIR, 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Bootstrap function that handles configuration
async function bootstrap() {
  console.log('🔧 Stream Alert Configuration');
  console.log('================================\n');

  // Create readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Helper function to prompt user for input
  function prompt(question: string, defaultValue: string | null = null): Promise<string> {
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
  function validateAndConvert(value: string, type: string, fieldName: string): any {
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
  function isEnvVariable(value: any): boolean {
    return typeof value === 'string' && value.startsWith('@@');
  }

  try {
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

    // Write updated config back to file
    const updatedConfig = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, updatedConfig);

    // Start the NestJS application

    const customLogger = new CustomLogger();
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: customLogger,
    });

    console.log('Application started successfully');

  } catch (error) {
    console.error('❌ Configuration error:', (error as Error).message);
    rl.close();
    process.exit(1);
  }
}

bootstrap();
