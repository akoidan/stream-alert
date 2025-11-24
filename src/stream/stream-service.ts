import {Inject, Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from '@/app/app-model';
import {INativeModule, Native} from '@/native/native-model';
import {CameraConfData} from '@/config/config-resolve-model';
import {CameraConfig} from '@/config/config-zod-schema';

@Injectable()
export class StreamService {
  private exitTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly captureService: INativeModule,
    @Inject(CameraConfData)
    private readonly conf: CameraConfig,
  ) {
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    // Start capture with the new API - pass the callback directly
    this.exitOnTimeout();
    this.captureService.start(this.conf.name, this.conf.frameRate, async(frameInfo: any) => {
      clearTimeout(this.exitTimeout!);
      this.exitOnTimeout();
      if (frameInfo) {
        process.stdout.write('.');
        await frameListener.onNewFrame(frameInfo);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.conf.name}`);
  }

  private exitOnTimeout() {
    this.exitTimeout = setTimeout(() => {
      throw Error('Frame capturing didn\'t produce any data for 5s, exiting...');
    }, 5000);
  }
}
