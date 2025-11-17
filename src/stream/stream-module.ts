/// <reference path="../../config/Config.d.ts" />
import {Logger, Module, OnModuleInit} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {config} from 'node-config-ts'
import {StreamService} from "@/stream/stream-service";
import {TelegramModule} from "@/telegram/telegram-module";
import {ImagelibModule} from "@/imagelib/imagelib-module";

import {ImagelibService} from "@/imagelib/imagelib-service";

@Module({
  imports: [TelegramModule, ImagelibModule],
  providers: [
    Logger,
    {
      provide: StreamService,
      useFactory: function (logger: Logger, tg: TelegramService, il: ImagelibService) {
        return new StreamService(
          logger,
          tg,
          il,
          config.camera,
          config.frameRate,
        )
      },
      inject: [Logger, TelegramService, ImagelibService],
    }
  ],
})
export class StreamModule implements OnModuleInit {

  constructor(private readonly ss: StreamService) {
  }

  async onModuleInit() {
    await this.ss.listen();
  }
}
