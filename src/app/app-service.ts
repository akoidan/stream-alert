import {Injectable, Logger} from '@nestjs/common';
import {TelegramService} from "@/telegram/telegram-service";
import {ImagelibService} from "@/imagelib/imagelib-service";
import {StreamService} from "@/stream/stream-service";
import type {GlobalService} from "@/app/app-model";
import {CommandContextExtn} from "telegraf/typings/telegram-types";
import {TelegramCommands} from "@/telegram/telegram-model";

@Injectable()
export class AppService implements GlobalService {

  constructor(
    private readonly logger: Logger,
    private readonly ss: StreamService,
    private readonly telegram: TelegramService,
    private readonly im: ImagelibService,
  ) {
  }

  async onIncreaseThreshold(): Promise<void> {
    this.im.diffThreshold = Math.ceil(this.im.diffThreshold * 2);
    await this.telegram.sendText(`Increase threshold to ${this.im.diffThreshold}`);
  }

  async onDecreaseThreshold(): Promise<void> {
    this.im.diffThreshold = Math.ceil(this.im.diffThreshold / 2);
    await this.telegram.sendText(`Decreased threshold to ${this.im.diffThreshold}`);
  }

  async onAskImage(): Promise<void> {
    this.logger.log(`Got image command`);
    const image = await this.im.getLastImage();
    if (image) {
      await this.telegram.sendImage(image);
    } else {
      await this.telegram.sendText(`No image in cache`);
      this.logger.log(`No current image found, skipping`);
    }
  }

  async onSetThreshold(a: CommandContextExtn): Promise<void> {
    const newThreshold = Number(a.payload)
    if (newThreshold > 0) {
      this.im.diffThreshold = newThreshold;
    } else {
      await this.telegram.sendText(`${TelegramCommands.set_threshold} required number parameter. ${a.payload} is not a number`);
    }
  }

  public async onNewFrame(frameData: Buffer<ArrayBuffer>) {
    const image = await this.im.getImageIfItsChanged(frameData);
    if (image) {
      await this.telegram.sendImage(image);
    }
  }

  async run(): Promise<void> {
    await this.ss.listen(this);
    await this.telegram.setup(this);
  }
}
