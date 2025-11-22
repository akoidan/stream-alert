import {join} from 'path'
import * as process from 'node:process';
process.env['NODE_CONFIG_TS_DIR'] = join(__dirname, 'config')

import { readFileSync } from 'node:fs';

console.log(`settings NODE_CONFIG_TS_DIR to ${process.env['NODE_CONFIG_TS_DIR']}`)


const content = readFileSync(join(process.env.NODE_CONFIG_TS_DIR, 'default.json'), 'utf-8');
console.log(content)


import {NestFactory} from '@nestjs/core';
import {CustomLogger} from '@/app/custom-logger';
import {AppModule} from "@/app/app-module";

const customLogger = new CustomLogger();
NestFactory.createApplicationContext(AppModule, {
  logger: customLogger,
}).catch((err: unknown) => {
  customLogger.error((err as Error)?.message ?? err, (err as Error)?.stack);
  process.exit(1);
});
