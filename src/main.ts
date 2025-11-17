import {NestFactory} from '@nestjs/core';
import {CustomLogger} from '@/app/custom-logger';
import * as process from 'node:process';
import {asyncLocalStorage} from '@/asyncstore/async-storage-value';
import {SemaphorService} from '@/semaphor/semaphor-service';
import {StreamModule} from "@/stream/stream-module";


asyncLocalStorage.run(new Map<string, string>().set(SemaphorService.COMB_KEY, 'init'), () => {
  const customLogger = new CustomLogger(asyncLocalStorage);
  NestFactory.createApplicationContext(StreamModule, {
    logger: customLogger,
  }).catch((err: unknown) => {
    customLogger.error((err as Error)?.message ?? err, (err as Error)?.stack);
    process.exit(1);
  });
});
