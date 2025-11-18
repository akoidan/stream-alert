import {Inject, Logger, Module} from '@nestjs/common';
import bindings from 'bindings';
import {INativeModule, Native} from "@/native/native-model";
import clc from "cli-color";


@Module({
  providers: [
    Logger,
    {
      provide: Native,
      useFactory: (): INativeModule => {
        // eslint-disable-next-line
        return bindings('native');
      },
    },
  ],
  exports: [Native],
})
export class NativeModule {
  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly native: INativeModule
  ) {
  }

  onModuleInit(): any {
    this.logger.log(`Loaded native library from ${clc.bold.green(this.native.path)}`);
  }
}
