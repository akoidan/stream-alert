import 'reflect-metadata';
import * as process from 'node:process';

import {NestFactory} from '@nestjs/core';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from '@/app/app-module';

import {isSea} from 'node:sea';

const customLogger = new CustomLogger();

if (isSea()) {
  process.removeAllListeners('warning');
  process.on('warning', (warning) => {
    if (warning.name === 'ExperimentalWarning') {
      return;
    }
    if ((warning as any).code === 'DEP0040') {
      return;
    } // punycode deprecation
    // log everything else normally
    customLogger.warn(`${warning.name} ${warning.message}`);
  });
}

NestFactory.createApplicationContext(AppModule, {
  logger: customLogger,
}).catch((err: unknown) => {
  customLogger.error((err as Error)?.message ?? err, (err as Error)?.stack);
  process.exit(1);
});
