import {Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from "@/app/app-model";
import { DirectShowCaptureService } from '@/native';

@Injectable()
export class StreamService {

  private captureService: DirectShowCaptureService;
  private frameInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly cameraName: string,
    private readonly frameRate: number,
  ) {
    this.captureService = new DirectShowCaptureService();
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    try {
      // Initialize DirectShow capture
      const initialized = this.captureService.initialize(this.cameraName, this.frameRate);
      if (!initialized) {
        throw new Error(`Failed to initialize DirectShow capture for device: ${this.cameraName}`);
      }

      // Start capture
      const started = this.captureService.start();
      if (!started) {
        throw new Error('Failed to start DirectShow capture');
      }

      this.logger.log(`DirectShow capture started for device: ${this.cameraName}`);

      // Start frame polling loop
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
