/// <reference path="../config/Config.d.ts" />
import {config} from 'node-config-ts'
import { Telegraf } from 'telegraf';

const bot = new Telegraf(config.telegram.token);

// Log chat id when someone sends a message to your bot
bot.on('message', (ctx) => {
  console.log('Chat ID:', ctx.chat.id);
  ctx.reply('I got your message!');
});

async function main() {
  await bot.launch();
  console.log('Bot launching...');
}
main()
