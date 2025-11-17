import {NestFactory} from '@nestjs/core';
import {CustomLogger} from '@/app/custom-logger';
import * as process from 'node:process';
import {StreamModule} from "@/stream/stream-module";


const customLogger = new CustomLogger();
NestFactory.createApplicationContext(StreamModule, {
  logger: customLogger,
}).catch((err: unknown) => {
  customLogger.error((err as Error)?.message ?? err, (err as Error)?.stack);
  process.exit(1);
});
