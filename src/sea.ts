import process from 'node:process';

import readline from 'readline';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';
import {NestFactory} from '@nestjs/core';
import {globalSeaConf} from '@/config-resolve/config-resolve-model'
import {getAsset} from 'node:sea';


const customLogger = new CustomLogger();

const text = getAsset('config-default-json', 'utf8');
Object.entries(JSON.parse(text)) .forEach(([key, value]) => {
  // @ts-ignore
  globalSeaConf[key] = value;
});


// Bootstrap function that handles configuration
async function bootstrap() {
  customLogger.log('🔧 Stream Alert Configuration');
  customLogger.log('================================\n');

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
    customLogger.log('📱 Telegram Configuration');
    customLogger.log('--------------------------');

    const telegramToken = isEnvVariable(globalSeaConf.telegram.token)
      ? await prompt('Telegram bot token')
      : await prompt('Telegram bot token', globalSeaConf.telegram.token);
    globalSeaConf.telegram.token = validateAndConvert(telegramToken, 'string', 'Telegram token');

    const telegramChatId = isEnvVariable(globalSeaConf.telegram.chatId)
      ? await prompt('Telegram chat ID')
      : await prompt('Telegram chat ID', globalSeaConf.telegram.chatId.toString());
    globalSeaConf.telegram.chatId = validateAndConvert(telegramChatId, 'number', 'Telegram chat ID');

    const telegramSpamDelay = isEnvVariable(globalSeaConf.telegram.spamDelay)
      ? await prompt('Spam delay in milliseconds')
      : await prompt('Spam delay in milliseconds', globalSeaConf.telegram.spamDelay.toString());
    globalSeaConf.telegram.spamDelay = validateAndConvert(telegramSpamDelay, 'number', 'Spam delay');

    const telegramMessage = isEnvVariable(globalSeaConf.telegram.message)
      ? await prompt('Default message for alerts')
      : await prompt('Default message for alerts', globalSeaConf.telegram.message);
    globalSeaConf.telegram.message = validateAndConvert(telegramMessage, 'string', 'Telegram message');

    customLogger.log('');

    // Configure Camera section
    customLogger.log('📷 Camera Configuration');
    customLogger.log('------------------------');

    const cameraName = isEnvVariable(globalSeaConf.camera.name)
      ? await prompt('Camera name')
      : await prompt('Camera name', globalSeaConf.camera.name);
    globalSeaConf.camera.name = validateAndConvert(cameraName, 'string', 'Camera name');

    const cameraFrameRate = isEnvVariable(globalSeaConf.camera.frameRate)
      ? await prompt('Frame rate (frames per second)')
      : await prompt('Frame rate (frames per second)', globalSeaConf.camera.frameRate.toString());
    globalSeaConf.camera.frameRate = validateAndConvert(cameraFrameRate, 'number', 'Frame rate');

    customLogger.log('');

    // Configure Diff section
    customLogger.log('🔍 Motion Detection Configuration');
    customLogger.log('----------------------------------');

    const diffPixels = isEnvVariable(globalSeaConf.diff.pixels)
      ? await prompt('Minimum pixels changed to trigger detection')
      : await prompt('Minimum pixels changed to trigger detection', globalSeaConf.diff.pixels.toString());
    globalSeaConf.diff.pixels = validateAndConvert(diffPixels, 'number', 'Diff pixels');

    const diffThreshold = isEnvVariable(globalSeaConf.diff.threshold)
      ? await prompt('Threshold for pixel changes (0.0 - 1.0)')
      : await prompt('Threshold for pixel changes (0.0 - 1.0)', globalSeaConf.diff.threshold.toString());
    const threshold = validateAndConvert(diffThreshold, 'number', 'Diff threshold');
    if (threshold < 0 || threshold > 1) {
      throw new Error('Diff threshold must be between 0.0 and 1.0');
    }
    globalSeaConf.diff.threshold = threshold;

    customLogger.log('\n✅ Configuration completed successfully!');
    customLogger.log('Starting application...\n');

    rl.close();
    

    // Start the NestJS application


    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: customLogger,
    });

    customLogger.log('Application started successfully');

  } catch (error) {
    console.error('❌ Configuration error:', (error as Error).message);
    rl.close();
    process.exit(1);
  }
}

bootstrap();
