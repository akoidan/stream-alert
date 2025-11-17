/// <reference path="../config/Config.d.ts" />
import {spawn} from "child_process";
import {Jimp, JimpInstance} from "jimp";
import pixelmatch from "pixelmatch";
import {config} from 'node-config-ts'
import { Telegraf } from 'telegraf';


let lastFrame: JimpInstance | null = null;

const ff = spawn("ffmpeg.exe", [
  "-f", "dshow",
  "-i", `video=${config.camera}`,
  "-r", `${config.frameRate}`,
  "-vcodec", "mjpeg",
  "-f", "image2pipe",
  "-"
]);

ff.stderr.on("data", d => {
  // Device / FFmpeg logs
  // console.error(String(d));
});

// Buffer accumulator because JPEG frames are variable-size
let buffer: Buffer = Buffer.alloc(0);
const bot = new Telegraf(config.telegram.token);
let lastNotificationTime = Date.now();

bot.on("message", async message => {
  console.log(message);
})
async function sendNotification() {
  try {
    let newNotificationTime = Date.now();
    if (newNotificationTime - lastNotificationTime > config.telegram.spamDelay) {
      await bot.telegram.sendMessage(config.telegram.chatId, 'Core is UP!');
    } else {
      console.log('skipping notification');
    }
  } catch (e) {
    console.error(e);
  }
}

ff.stdout.on("data", async chunk => {

  try {
    buffer = Buffer.concat([buffer, chunk]);

    // Look for JPEG frame boundaries
    const SOI = buffer.indexOf(Buffer.from([0xFF, 0xD8]) as Uint8Array); // Start of Image
    const EOI = buffer.indexOf(Buffer.from([0xFF, 0xD9]) as Uint8Array); // End of Image

    if (SOI === -1 || EOI === -1 || EOI < SOI) {
      return;
    }
    const frameData = buffer.slice(SOI, EOI + 2);
    buffer = buffer.slice(EOI + 2);
    const frame = await Jimp.read(frameData);

    if (!lastFrame) {
      lastFrame = frame as JimpInstance;
      return;
    }
    const {width, height} = frame.bitmap;

    const diffPixels = pixelmatch(
      frame.bitmap.data as Uint8Array,
      lastFrame.bitmap.data as Uint8Array,
      null!,
      width,
      height,
      {threshold: config.threshold}
    );
    lastFrame = frame as JimpInstance;

    if (diffPixels > config.diffThreshold) {
      console.log(`⚠️ CHANGE DETECTED: ${diffPixels}`);
      await sendNotification();
    } else {
      process.stdout.write(".");
    }
  } catch (err) {
    console.error("Failed to parse frame", err);
  }
});
