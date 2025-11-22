import {Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from "@/app/app-model";
import {INativeModule} from "@/native/native-model";

@Injectable()
export class StreamService {

  private exitTimeout: NodeJS.Timeout| null = null;

  constructor(
    private readonly logger: Logger,
    private readonly captureService: INativeModule,
    private readonly cameraName: string,
    private readonly frameRate: number,
  ) {
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    // Start capture with the new API - pass the callback directly
    this.exitOnTimeout();
    this.captureService.start(this.cameraName, this.frameRate, async (frameInfo: any) => {
      clearTimeout(this.exitTimeout!);
      this.exitOnTimeout()
      if (frameInfo) {
        process.stdout.write(".");
        await frameListener.onNewFrame(frameInfo);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.cameraName}`);
  }

  private exitOnTimeout() {
    this.exitTimeout = setTimeout(() => {
      throw Error("Frame capturing didn't produce any data for 5s, exiting...")
    }, 5000);
  }
}
