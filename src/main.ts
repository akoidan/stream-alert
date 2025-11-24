import 'reflect-metadata';

import {NestFactory} from '@nestjs/core';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';

const customLogger = new CustomLogger();

NestFactory.createApplicationContext(AppModule, {
  logger: customLogger,
}).catch((err: unknown) => {
  customLogger.error((err as Error)?.message ?? err, (err as Error)?.stack);
  process.exit(1);
});
