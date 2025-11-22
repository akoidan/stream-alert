/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {config} from 'node-ts-config'
import {StreamService} from "@/stream/stream-service";
import {NativeModule} from "@/native/native-module";
import {CameraConf} from "@/stream/stream-model";

@Module({
  imports: [NativeModule],
  exports: [StreamService],
  providers: [
    Logger,
    {
      provide: CameraConf,
      useValue: config.camera
    },
    StreamService,
  ],
})
export class StreamModule {

}
