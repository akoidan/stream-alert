import {Inject, Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from '@/app/app-model';
import {INativeModule, Native, FrameData} from '@/native/native-model';
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

  listen(frameListener: FrameDetector): void {
    // Start capture with the new API - pass the callback directly
    this.exitOnTimeout();
    this.captureService.start(this.conf.name, this.conf.frameRate, (frameInfo: any) => {
      clearTimeout(this.exitTimeout!);
      this.exitOnTimeout();
      if (frameInfo) {
        process.stdout.write('.');
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        void frameListener.onNewFrame(frameInfo as FrameData);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.conf.name}`);
  }

  private exitOnTimeout(): void {
    this.exitTimeout = setTimeout(() => {
      throw Error('Frame capturing didn\'t produce any data for 5s, exiting...');
    }, 5000);
  }
}
