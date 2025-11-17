/// <reference path="../../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {config} from 'node-config-ts'
import {StreamService} from "@/stream/stream-service";
import {TelegramModule} from "@/telegram/telegram-module";
import {ImagelibModule} from "@/imagelib/imagelib-module";
import {SemaphorService} from "@/semaphor/semaphor-service";
import {ImagelibService} from "@/imagelib/imagelib-service";

@Module({
  imports: [TelegramModule, ImagelibModule],
  providers: [
    Logger,
    {
      provide: StreamService,
      useFactory: function (logger: Logger, tg: TelegramService, sf: SemaphorService, il: ImagelibService) {
        return new StreamService(
          logger,
          tg,
          sf,
          il,
          config.camera,
          config.frameRate,
        )
      },
      inject: [Logger, TelegramService, SemaphorService, ImagelibService],
    }
  ],
})
export class StreamModule {

}
