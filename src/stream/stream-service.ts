import {Injectable, Logger} from '@nestjs/common';
import {spawn} from "child_process";
import type {FrameDetector} from "@/app/app-model";

@Injectable()
export class StreamService {

  private buffer: Buffer = Buffer.alloc(0);
  private readonly ffmpegArgs: string[];

  constructor(
    private readonly logger: Logger,
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

  async listen(frameListener: FrameDetector): Promise<void> {
    const ff = spawn("ffmpeg", this.ffmpegArgs);

    ff.stderr.on("data", d => {
      const data = String(d);
      if (!data.startsWith("frame=")) {
        console.error(data);
      }
    });

    ff.stdout.on("data", async chunk => {
      process.stdout.write(".");
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
        await frameListener.onNewFrame(frameData);
      } catch (err) {
        this.logger.error("Failed to parse frame", err);
      }
    })
  }
}
