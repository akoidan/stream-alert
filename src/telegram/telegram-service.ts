import {Injectable, Logger} from '@nestjs/common';
import {Telegraf} from "telegraf";

@Injectable()
export class TelegramService {
  private lastNotificationTime = 0;

  constructor(
    private readonly logger: Logger,
    private readonly bot: Telegraf,
    private readonly chatId: number,
    private readonly tgMessage: string,
    private readonly spamDelay: number,
  ) {
  }

  async sendMessage(data: Buffer,): Promise<void> {
    const newNotificationTime = Date.now();
    if (newNotificationTime - this.lastNotificationTime > this.spamDelay) {
      await this.bot.telegram.sendPhoto(this.chatId, {source: data}, {caption: this.tgMessage});
      this.lastNotificationTime = newNotificationTime;
      this.logger.log("Notification sent");
    } else {
      this.logger.log('skipping notification');
    }
  }
}
