/// <reference path="../../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {Telegraf} from "telegraf";
import {config} from 'node-config-ts'

@Module({
  exports: [TelegramService],
  providers: [
    Logger,
    {
      provide: TelegramService,
      useFactory: function (logger: Logger) {
        const telegraph = new Telegraf(config.telegram.token);
        return new TelegramService(
          logger,
          telegraph,
          config.telegram.chatId,
          config.telegram.message,
          config.telegram.spamDelay,
        )
      },
      inject: [Logger],
    }
  ],
})
export class TelegramModule {

}
