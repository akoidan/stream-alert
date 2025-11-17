/// <reference path="../../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {config} from 'node-config-ts'
import {StreamService} from "@/stream/stream-service";

@Module({
  exports: [StreamService],
  providers: [
    Logger,
    {
      provide: StreamService,
      useFactory: function (logger: Logger) {
        return new StreamService(
          logger,
          config.camera,
          config.frameRate,
        )
      },
      inject: [Logger],
    }
  ],
})
export class StreamModule {

}
