import {Logger, Module} from '@nestjs/common';
import {TelegramService} from '@/telegram/telegram-service';
import {Telegraf} from 'telegraf';
import {ConfigResolveModule} from '@/config/config-resolve-module';
import {TelegramConfigData} from '@/config/config-resolve-model';
import {TelegramConfig} from '@/config/config-zod-schema';

@Module({
  imports: [ConfigResolveModule],
  exports: [TelegramService],
  providers: [
    Logger,
    TelegramService,
    {
      provide: Telegraf,
      useFactory: (tg: TelegramConfig): Telegraf => {
        return new Telegraf(tg.token);
      },
      inject: [TelegramConfigData],
    },
  ],
})
export class TelegramModule {

}
