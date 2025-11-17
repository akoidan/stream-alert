/// <reference path="../../config/Config.d.ts" />
import {Logger, Module, OnModuleInit} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {config} from 'node-config-ts'
import {StreamService} from "@/stream/stream-service";
import {TelegramModule} from "@/telegram/telegram-module";
import {ImagelibModule} from "@/imagelib/imagelib-module";

import {ImagelibService} from "@/imagelib/imagelib-service";
import {StreamModule} from "@/stream/stream-module";

@Module({
  imports: [StreamModule, TelegramModule, ImagelibModule],
})
export class AppModule implements OnModuleInit {

  constructor(
    private readonly ss: StreamService,
    private readonly telegram: TelegramService,
    private readonly im: ImagelibService) {
  }

  async onModuleInit() {
    await this.ss.listen(async (frameData: Buffer<ArrayBuffer>) => {
      const image = await this.im.getImageIfItsChanged(frameData);
      if (image) {
        await this.telegram.sendMessage(image);
      }
    });
  }
}
