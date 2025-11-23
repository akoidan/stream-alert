import process from 'node:process';
// @ts-ignore
import prompts from 'prompts';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';
import {NestFactory} from '@nestjs/core';
import {globalSeaConf} from '@/config-resolve/config-resolve-model';
import {getAsset} from 'node:sea';


process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') return;
  if ((warning as any).code === 'DEP0040') return; // punycode deprecation
  // log everything else normally
  console.warn(warning.name, warning.message);
});

const customLogger = new CustomLogger();

const text = getAsset('config-default-json', 'utf8');
globalSeaConf.data = JSON.parse(text);

function getInitial<T>(value: T): T|undefined {
  return typeof value === 'string' && value.startsWith('@@') ? undefined : value;
}

function getConfigQuestions() {
  return [
    {
      type: (prev: any) => {
        console.log('\n🤖 First, create a Telegram bot:\n'
          + '  1. Open @BotFather in Telegram\n'
          + '  2. Send /newbot and follow the instructions\n'
          + '  3. Save the bot token for the next step\n');
        return null;
      },
      name: null
    },
    {
      type: 'text',
      name: 'telegramToken',
      message: '🔑 Bot token (from @BotFather)',
      validate: (value: any) => /^\d{10}:[a-zA-Z0-9_-]{35}$/.test(value) || 'Invalid token format (should be like: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)',
      initial: getInitial(globalSeaConf.data.telegram.token)
    },
    {
      type: 'number',
      name: 'telegramChatId',
      message: '💬 Your Telegram chat ID (get it from @userinfobot)',
      initial: getInitial(globalSeaConf.data.telegram.chatId),
      validate: (value: any) => value > 10000 || 'Chat ID must be a positive number'
    },
    {
      type: 'number',
      name: 'telegramSpamDelay',
      message: '⏱️  Delay between alerts (milliseconds, min 10000 recommended)',
      initial: getInitial(globalSeaConf.data.telegram.spamDelay),
      validate: (value: any) => value >= 0 || 'Delay must be non-negative'
    },
    {
      type: 'text',
      name: 'telegramMessage',
      message: '📨 Alert message text',
      initial: getInitial(globalSeaConf.data.telegram.message)
    },
    {
      type: 'text',
      name: 'cameraName',
      message: '📹 Camera name (e.g., "OBS Virtual Camera" or your webcam)',
      initial: getInitial(globalSeaConf.data.camera.name)
    },
    {
      type: 'number',
      name: 'cameraFrameRate',
      message: '🎬 Frame rate (frames per second, e.g., 1-5)',
      initial: getInitial(globalSeaConf.data.camera.frameRate),
      validate: (value: any) => value > 0 || 'Frame rate must be positive'
    },
    {
      type: 'number',
      name: 'diffPixels',
      message: '🔍 Minimum changed pixels to trigger alert',
      initial: getInitial(globalSeaConf.data.diff.pixels),
      validate: (value: any) => value > 0 || 'Pixel count must be positive'
    },
    {
      type: 'number',
      name: 'diffThreshold',
      message: '🎯 Change sensitivity (0.0-1.0, try 0.1)',
      initial: getInitial(globalSeaConf.data.diff.threshold),
      validate: (value: any) => (value >= 0 && value <= 1) || 'Threshold must be between 0.0 and 1.0'
    }
  ];
}

async function bootstrap(): Promise<void> {
  
  customLogger.log('🔧 Stream Alert Configuration');
  customLogger.log('================================\n');

  try {
    const questions = getConfigQuestions();
    const responses = await prompts(questions);

    // Update global configuration with responses
    globalSeaConf.data.telegram.token = responses.telegramToken;
    globalSeaConf.data.telegram.chatId = responses.telegramChatId;
    globalSeaConf.data.telegram.spamDelay = responses.telegramSpamDelay;
    globalSeaConf.data.telegram.message = responses.telegramMessage;
    
    globalSeaConf.data.camera.name = responses.cameraName;
    globalSeaConf.data.camera.frameRate = responses.cameraFrameRate;
    
    globalSeaConf.data.diff.pixels = responses.diffPixels;
    globalSeaConf.data.diff.threshold = responses.diffThreshold;
    
    customLogger.log('\n✅ Configuration completed successfully!');
    customLogger.log('Starting application...\n');

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: customLogger,
    });

    customLogger.log('Application started successfully');
  } catch (error) {
    console.error('❌ Configuration error:', (error as Error).message);
    process.exit(1);
  }
}

bootstrap();
