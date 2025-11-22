/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {Telegraf} from "telegraf";
import {config} from 'node-ts-config'
import {TelegramConfig} from "@/telegram/telegram-model";

@Module({
  exports: [TelegramService],
  providers: [
    Logger,
    TelegramService,
    {
      provide: Telegraf,
      useFactory: () => {
        return new Telegraf(config.telegram.token);
      },
    },
    {
      provide: TelegramConfig,
      useValue: config.telegram,
    }
  ],
})
export class TelegramModule {

}
