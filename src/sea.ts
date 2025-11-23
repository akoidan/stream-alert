import process from 'node:process';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';
import {NestFactory} from '@nestjs/core';
import {getAsset} from 'node:sea';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') return;
  if ((warning as any).code === 'DEP0040') return; // punycode deprecation
  // log everything else normally
  console.warn(warning.name, warning.message);
});

const customLogger = new CustomLogger();

async function bootstrap(): Promise<void> {
  customLogger.log('🔧 Stream Alert Configuration');
  customLogger.log('================================\n');

  try {
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
