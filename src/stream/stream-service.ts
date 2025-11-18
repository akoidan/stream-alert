import {Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from "@/app/app-model";
import { INativeModule } from '@/native/native-model';

@Injectable()
export class StreamService {
  private frameInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly captureService: INativeModule,
    private readonly cameraName: string,
    private readonly frameRate: number,
  ) {
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    try {
      this.captureService.initialize(this.cameraName, this.frameRate);
      this.captureService.start();

      this.logger.log(`DirectShow capture started for device: ${this.cameraName}`);

      const intervalMs = Math.floor(1000 / this.frameRate);
      this.frameInterval = setInterval(async () => {
        try {
          const frameData = this.captureService.getFrame();
          if (frameData) {
            process.stdout.write(".");
            await frameListener.onNewFrame(frameData as Buffer<ArrayBuffer>);
          }
        } catch (err) {
          this.logger.error("Failed to process frame", err);
        }
      }, intervalMs);
    } catch (err) {
      this.logger.error("Failed to start DirectShow capture", err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    try {
      this.captureService.stop();
      this.logger.log("DirectShow capture stopped");
    } catch (err) {
      this.logger.error("Failed to stop DirectShow capture", err);
    }
  }
}
