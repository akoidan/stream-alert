import {Inject, Logger, Module, OnModuleInit} from '@nestjs/common';
import bindings from 'bindings';
import {INativeModule, Native} from "@/native/native-model";
import clc from "cli-color";
import {getAsset, isSea} from "node:sea";
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {createRequire} from 'node:module';

@Module({
  providers: [
    Logger,
    {
      provide: Native,
      useFactory: (): INativeModule => {
        if (isSea()) {
          const tmp = mkdtempSync(join(tmpdir(), 'sea-'));
          const pathOnDisk = join(tmp, 'native.node');
          writeFileSync(pathOnDisk, Buffer.from(getAsset('native')));
          const requireFromHere = createRequire(__filename);
          return requireFromHere(pathOnDisk)
        } else {
          return bindings('native');
        }
      },
    },
  ],
  exports: [Native],
})
export class NativeModule implements OnModuleInit{

  constructor(
    @Inject(Native)
    private readonly native: INativeModule,
    private readonly logger: Logger,
  ) {
  }

  onModuleInit(): any {
    this.logger.log(`Loaded native library from ${clc.bold.green(this.native.path)}`);
  }
}
