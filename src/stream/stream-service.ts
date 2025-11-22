import {Inject, Injectable, Logger} from '@nestjs/common';
import type {FrameDetector} from "@/app/app-model";
import {INativeModule, Native} from "@/native/native-model";
import {Camera} from "node-ts-config";
import {CameraConf} from "@/stream/stream-model";

@Injectable()
export class StreamService {

  private exitTimeout: NodeJS.Timeout| null = null;

  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly captureService: INativeModule,
    @Inject(CameraConf)
    private readonly conf: Camera,
  ) {
  }

  async listen(frameListener: FrameDetector): Promise<void> {
    // Start capture with the new API - pass the callback directly
    this.exitOnTimeout();
    this.captureService.start(this.conf.name, this.conf.frameRate, async (frameInfo: any) => {
      clearTimeout(this.exitTimeout!);
      this.exitOnTimeout()
      if (frameInfo) {
        process.stdout.write(".");
        await frameListener.onNewFrame(frameInfo);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.conf.name}`);
  }

  private exitOnTimeout() {
    this.exitTimeout = setTimeout(() => {
      throw Error("Frame capturing didn't produce any data for 5s, exiting...")
    }, 5000);
  }
}
