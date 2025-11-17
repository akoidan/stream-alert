/// <reference path="../config/Config.d.ts" />
import {spawn} from "child_process";
import {Jimp, JimpInstance} from "jimp";
import pixelmatch from "pixelmatch";
import {config} from 'node-config-ts'



let lastFrame: JimpInstance | null = null;

const ff = spawn("ffmpeg.exe", [
  "-f", "dshow",
  "-i", `video=${config.camera}`,
  "-r", "1",
  "-vcodec", "mjpeg",
  "-f", "image2pipe",
  "-"
]);

ff.stderr.on("data", d => {
  // Device / FFmpeg logs
  // console.error(String(d));
});

// Buffer accumulator because JPEG frames are variable-size
let buffer = Buffer.alloc(0);

let lastNotificationTime = Date.now();

async function sendNotification() {
  try {
    let newNotificationTime = Date.now();
    if (newNotificationTime - lastNotificationTime > 10000) {
      await fetch(`https://api.pushcut.io/${config.pushcut.token}/notifications/${encodeURIComponent(config.pushcut.token)}`, {
        method: 'POST',
      })
      lastNotificationTime = newNotificationTime
      console.log('Notified the phone')
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
    const SOI = buffer.indexOf(Buffer.from([0xFF, 0xD8])); // Start of Image
    const EOI = buffer.indexOf(Buffer.from([0xFF, 0xD9])); // End of Image

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
      frame.bitmap.data,
      lastFrame.bitmap.data,
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
