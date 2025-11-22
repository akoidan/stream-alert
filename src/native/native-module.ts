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
        // Check if we're running in a SEA context by looking for sea-assets folder
        return bindings('native');
      },
    },
  ],
  exports: [Native],
})
export class NativeModule {

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
