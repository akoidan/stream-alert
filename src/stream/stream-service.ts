import {Injectable, Logger} from '@nestjs/common';
import {spawn} from "child_process";
import {TelegramService} from "@/telegram/telegram-service";
import {SemaphorService} from "@/semaphor/semaphor-service";
import {ImagelibService} from "@/imagelib/imagelib-service";

@Injectable()
export class StreamService {

  private buffer: Buffer = Buffer.alloc(0);
  private readonly ffmpegArgs: string[];

  constructor(
    private readonly logger: Logger,
    private readonly telegram: TelegramService,
    private readonly semaphore: SemaphorService,
    private readonly imageLib: ImagelibService,
    cameraName: string,
    frameRate: number,
  ) {
    this.ffmpegArgs = [
      "-f", "dshow",
      "-i", `video=${cameraName}`,
      "-r", `${frameRate}`,
      "-vcodec", "mjpeg",
      "-f", "image2pipe",
      "-"
    ]
  }

  async listen(): Promise<void> {
    const ff = spawn("ffmpeg", this.ffmpegArgs);

    ff.stderr.on("data", d => {
      // Device / FFmpeg logs
      this.logger.error(String(d));
    });

    let i = 0;
    ff.stdout.on("data", async chunk => {
      process.stdout.write(".");
      await this.semaphore.spawnPromiseChild(`${i++}`, async () => {
        try {
          this.buffer = Buffer.concat([this.buffer, chunk]);

          // Look for JPEG frame boundaries
          const SOI = this.buffer.indexOf(Buffer.from([0xFF, 0xD8]) as Uint8Array); // Start of Image
          const EOI = this.buffer.indexOf(Buffer.from([0xFF, 0xD9]) as Uint8Array); // End of Image

          if (SOI === -1 || EOI === -1 || EOI < SOI) {
            return;
          }
          const frameData = this.buffer.slice(SOI, EOI + 2);
          this.buffer = this.buffer.slice(EOI + 2);

          const image = await this.imageLib.getImageIfItsChanged(frameData);
          if (image) {
            await this.telegram.sendMessage(image);
          }
        } catch (err) {
          this.logger.error("Failed to parse frame", err);
        }
      });
    })
  }
}
