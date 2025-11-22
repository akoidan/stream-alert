/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {config} from 'node-ts-config'
import {ImagelibService} from "@/imagelib/imagelib-service";
import {NativeModule} from "@/native/native-module";
import {imageLibConf} from "@/imagelib/imagelib-model";

@Module({
  imports: [NativeModule],
  providers: [
    Logger,
    {
      provide: imageLibConf,
      useValue: config.diff,
    },
    ImagelibService,
  ],
  exports: [ImagelibService]
})
export class ImagelibModule {

}
