import process from 'node:process';
// @ts-ignore
import prompts from 'prompts';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';
import {NestFactory} from '@nestjs/core';
import {globalSeaConf} from '@/config-resolve/config-resolve-model';
import {getAsset} from 'node:sea';


const customLogger = new CustomLogger();

const text = getAsset('config-default-json', 'utf8');
globalSeaConf.data = JSON.parse(text);

function getInitial<T>(value: T): T|undefined {
  return typeof value === 'string' && value.startsWith('@@') ? undefined : value;
}

function getConfigQuestions() {
  return [
    {
      type: 'text',
      name: 'telegramToken',
      message: '📱 Telegram bot token',
      initial: getInitial(globalSeaConf.data.telegram.token)
    },
    {
      type: 'number',
      name: 'telegramChatId',
      message: '📱 Telegram chat ID',
      initial: getInitial(globalSeaConf.data.telegram.chatId),
      validate: (value: any) => value > 0 || 'Chat ID must be positive'
    },
    {
      type: 'number',
      name: 'telegramSpamDelay',
      message: '📱 Spam delay in milliseconds',
      initial: getInitial(globalSeaConf.data.telegram.spamDelay),
      validate: (value: any) => value >= 0 || 'Spam delay must be non-negative'
    },
    {
      type: 'text',
      name: 'telegramMessage',
      message: '📱 Default message for alerts',
      initial: getInitial(globalSeaConf.data.telegram.message)
    },
    {
      type: 'text',
      name: 'cameraName',
      message: '📷 Camera name',
      initial: getInitial(globalSeaConf.data.camera.name)
    },
    {
      type: 'number',
      name: 'cameraFrameRate',
      message: '📷 Frame rate (frames per second)',
      initial: getInitial(globalSeaConf.data.camera.frameRate),
      validate: (value: any) => value > 0 || 'Frame rate must be positive'
    },
    {
      type: 'number',
      name: 'diffPixels',
      message: '🔍 Minimum pixels changed to trigger detection',
      initial: getInitial(globalSeaConf.data.diff.pixels),
      validate: (value: any) => value > 0 || 'Pixels must be positive'
    },
    {
      type: 'number',
      name: 'diffThreshold',
      message: '🔍 Threshold for pixel changes (0.0 - 1.0)',
      initial: getInitial(globalSeaConf.data.diff.threshold) ,
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
