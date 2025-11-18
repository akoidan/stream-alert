/// <reference path="../../config/Config.d.ts" />
import {Logger, Module, OnModuleInit} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {StreamService} from "@/stream/stream-service";
import {TelegramModule} from "@/telegram/telegram-module";
import {ImagelibModule} from "@/imagelib/imagelib-module";

import {ImagelibService} from "@/imagelib/imagelib-service";
import {StreamModule} from "@/stream/stream-module";
import {AppService} from "@/app/app-service";

@Module({
  imports: [StreamModule, TelegramModule, ImagelibModule],
  providers: [Logger, AppService]
})
export class AppModule implements OnModuleInit {

  constructor(
    private readonly as: AppService,
  ) {
  }

  async onModuleInit() {
    await this.as.run();
  }
}
