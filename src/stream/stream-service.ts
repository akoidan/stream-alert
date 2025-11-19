import {Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from "@/app/app-model";
import {INativeModule} from "@/native/native-model";

@Injectable()
export class StreamService {

  constructor(
    private readonly logger: Logger,
    private readonly captureService: INativeModule,
    private readonly cameraName: string,
    private readonly frameRate: number,
  ) {
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    // Start capture with the new API - pass the callback directly
    this.captureService.start(this.cameraName, this.frameRate, async (frameInfo: any) => {
      const frameData = this.captureService.getFrame();
      if (frameData) {
        process.stdout.write(".");
        await frameListener.onNewFrame(frameData as Buffer<ArrayBuffer>);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.cameraName}`);
  }
}
