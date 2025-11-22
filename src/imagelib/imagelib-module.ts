/// <reference path="../../config/Config.d.ts" />
import {Logger, Module, OnModuleInit} from '@nestjs/common';
import {config} from 'node-config-ts'
import {ImagelibService} from "@/imagelib/imagelib-service";
import {INativeModule, Native} from "@/native/native-model";
import {NativeModule} from "@/native/native-module";

@Module({
  imports: [NativeModule],
  providers: [
    Logger,
    {
      provide: ImagelibService,
      useFactory: function (logger: Logger, native: INativeModule) {
        return new ImagelibService(logger, native, config.threshold, config.diffThreshold)
      },
      inject: [Logger, Native],
    }
  ],
  exports: [ImagelibService]
})
export class ImagelibModule {

}
