/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {Telegraf} from "telegraf";
import {ConfigResolveModule} from "@/config-resolve/config-resolve-module";
import {TelegramConfig} from "@/config-resolve/config-resolve-model";
import type {Telegram} from "node-ts-config";

@Module({
  imports: [ConfigResolveModule],
  exports: [TelegramService],
  providers: [
    Logger,
    TelegramService,
    {
      provide: Telegraf,
      useFactory: (tg: Telegram): Telegraf => {
        return new Telegraf(tg.token);
      },
      inject: [TelegramConfig],
    },
  ],
})
export class TelegramModule {

}
