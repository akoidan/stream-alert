/// <reference path="../../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {config} from 'node-config-ts'
import {StreamService} from "@/stream/stream-service";
import {NativeModule} from "@/native/native-module";
import {INativeModule, Native} from "@/native/native-model";

@Module({
  imports: [NativeModule],
  exports: [StreamService],
  providers: [
    Logger,
    {
      provide: StreamService,
      useFactory: function (logger: Logger, native: INativeModule) {
        return new StreamService(
          logger,
          native,
          config.camera,
          config.frameRate,
        )
      },
      inject: [Logger, Native],
    }
  ],
})
export class StreamModule {

}
