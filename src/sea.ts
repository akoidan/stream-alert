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
        console.log('\n🔔 In order to use this program, you have to create new bot in Telegram.\n'
          +' Go to @botfather chat and type `/newbot`. Finish the flow until the end!\n');
        return null; // skip input
      },
      name: null
    },
    {
      type: 'text',
      name: 'telegramToken',
      message: '📱 Telegram bot token',
      validate: (value: any) => /^\d{10}:[a-zA-Z0-9]{35}$/.test(value),
      initial: getInitial(globalSeaConf.data.telegram.token)
    },
    {
      type: 'number',
      name: 'telegramChatId',
      message: '📱 Telegram chat ID. You can get by adding telegram bot @userinfobot ',
      initial: getInitial(globalSeaConf.data.telegram.chatId),
      validate: (value: any) => value > 10000 || 'Chat ID must be positive'
    },
    {
      type: 'number',
      name: 'telegramSpamDelay',
      message: '📱 Spam delay in milliseconds. How frequent 2 notifications can be sent on camera change. I would at least 10s, otherwise your TG can be spammed',
      initial: getInitial(globalSeaConf.data.telegram.spamDelay),
      validate: (value: any) => value >= 0 || 'Spam delay must be non-negative'
    },
    {
      type: 'text',
      name: 'telegramMessage',
      message: '📱 Default message for alerts. The message you receive on camera change to your tg user',
      initial: getInitial(globalSeaConf.data.telegram.message)
    },
    {
      type: 'text',
      name: 'cameraName',
      message: '📷 Camera name. You can get it from any software that read camera. E.g. you join https://meet.google.com/ create an instanc call, go to settings -> video and check camera list',
      initial: getInitial(globalSeaConf.data.camera.name)
    },
    {
      type: 'number',
      name: 'cameraFrameRate',
      message: '📷 Frame rate (frames per second). How often analyze the frames',
      initial: getInitial(globalSeaConf.data.camera.frameRate),
      validate: (value: any) => value > 0 || 'Frame rate must be positive'
    },
    {
      type: 'number',
      name: 'diffPixels',
      message: '🔍 How many pixels changed should produce a notification',
      initial: getInitial(globalSeaConf.data.diff.pixels),
      validate: (value: any) => value > 0 || 'Pixels must be positive'
    },
    {
      type: 'number',
      name: 'diffThreshold',
      message: '🔍 Threshold for pixel changes (0.0 - 1.0). Use value around 0.1. How each pixel should be different in order to mark it different',
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
