import {Inject, Injectable, Logger} from '@nestjs/common';
import {Telegraf} from "telegraf";
import {TelegramCommands} from "@/telegram/telegram-model";
import type {TgCommandsExecutor} from "@/app/app-model";
import {CommandContextExtn} from "telegraf/typings/telegram-types";
import {TelegramConfigData} from "@/config/config-resolve-model";
import {TelegramConfig} from "@/config/config-zod-schema";

@Injectable()
export class TelegramService {
  private lastNotificationTime: number = 0;
  private readonly created: number;

  constructor(
    private readonly logger: Logger,
    private readonly bot: Telegraf,
    @Inject(TelegramConfigData)
    private readonly tgConfig: TelegramConfig,
  ) {
    // Set last notification time to 3 seconds ago to allow for initial setup
    this.created = Date.now();
  }

  async setup(commandListener: TgCommandsExecutor): Promise<void> {
    this.logger.log("Starting telegram service");
    
    // Validate token first
    await this.validateToken();
    
    await this.bot.telegram.setMyCommands([
      {command: TelegramCommands.image, description: "Get the last image"},
      {
        command: TelegramCommands.set_threshold,
        description: "Sets new amount of pixels to be changes to fire a notification"
      },
      {
        command: TelegramCommands.increase_threshold,
        description: "Double the amount of pixels related to current value to spot a diff"
      },
      {
        command: TelegramCommands.decrease_threshold,
        description: "Reduces the amount of pixels related to current value to spot a diff"
      },
    ]);
    this.bot.command(TelegramCommands.image, () => commandListener.onAskImage());
    this.bot.command(TelegramCommands.set_threshold, (a: CommandContextExtn) => commandListener.onSetThreshold(a));
    this.bot.command(TelegramCommands.increase_threshold, () => commandListener.onIncreaseThreshold());
    this.bot.command(TelegramCommands.decrease_threshold, () => commandListener.onDecreaseThreshold());
    await this.bot.launch();
  }

  private async validateToken(): Promise<void> {
    try {
      const botInfo = await this.bot.telegram.getMe();
      this.logger.log(`Telegram bot validated: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      throw new Error('Telegram token validation failed. Please check your bot token.');
    }
  }

  async sendText(text: string): Promise<void> {
    await this.bot.telegram.sendMessage(this.tgConfig.chatId, text);
  }

  async sendImage(data: Buffer): Promise<void> {
    const newNotificationTime = Date.now();
    const diffDate = newNotificationTime - this.lastNotificationTime;
    if (this.lastNotificationTime === 0 && newNotificationTime - this.created < this.tgConfig.initialDelay * 1000) {
      this.logger.log(`Awaiting startup delay ${this.tgConfig.initialDelay}s before sending notification`);
      return;
    }
    if (this.lastNotificationTime !== 0 && diffDate < this.tgConfig.spamDelay * 1000) {
      this.logger.log(`Awaiting ${this.tgConfig.spamDelay}s before next notificaiton. ${Math.round(diffDate/ 1000)}s passed`);
      return
    }
    await this.bot.telegram.sendPhoto(this.tgConfig.chatId, {source: data}, {caption: this.tgConfig.message});
    this.lastNotificationTime = newNotificationTime;
    this.logger.log("Notification sent");
  }
}
