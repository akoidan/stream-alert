import {Injectable, Logger} from '@nestjs/common';
import {Telegraf} from "telegraf";
import {TelegramCommands} from "@/telegram/telegram-model";

@Injectable()
export class TelegramService {
  private lastNotificationTime = Date.now();

  constructor(
    private readonly logger: Logger,
    private readonly bot: Telegraf,
    private readonly chatId: number,
    private readonly tgMessage: string,
    private readonly spamDelay: number,
  ) {
  }

  async setup(onImage: () => Promise<void>): Promise<void> {
    this.logger.log("Starting telegram service");
    await this.bot.telegram.setMyCommands([
      {command: TelegramCommands.image, description: "Get the last image"},
    ]);
    this.bot.command(TelegramCommands.image, onImage);
    await this.bot.launch();
  }

  async sendMessage(data: Buffer): Promise<void> {
    const newNotificationTime = Date.now();
    const diffDate = newNotificationTime - this.lastNotificationTime;
    if (diffDate > this.spamDelay) {
      await this.bot.telegram.sendPhoto(this.chatId, {source: data}, {caption: this.tgMessage});
      this.lastNotificationTime = newNotificationTime;
      this.logger.log("Notification sent");
    } else {
      this.logger.log(`Skipping sending notification as the last one was sent ${diffDate}ms ago`);
    }
  }
}
