import {Inject, Injectable, Logger} from '@nestjs/common';
import {FrameData, INativeModule, Native} from '@/native/native-model';
import {Diff} from "node-ts-config";
import {imageLibConf} from "@/imagelib/imagelib-model";


@Injectable()
export class ImagelibService {
  private oldFrame: FrameData | null = null;

  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly native: INativeModule,
    @Inject(imageLibConf)
    public readonly conf: Diff,
  ) {
  }

  async getLastImage(): Promise<Buffer | null> {
    if (!this.oldFrame) {
      return null;
    }

    return await this.native.convertRgbToJpeg(this.oldFrame.buffer, this.oldFrame.width, this.oldFrame.height);
  }

  async getImageIfItsChanged(frameData: FrameData): Promise<Buffer | null> {
    if (!frameData || !frameData.buffer || frameData.buffer.length === 0) {
      return null;
    }

    if (!this.oldFrame) {
      this.oldFrame = frameData;
      return null;
    }

    const diffPixels = await this.native.compareRgbImages(
      this.oldFrame.buffer, 
      frameData.buffer, 
      frameData.width, 
      frameData.height, 
      this.conf.threshold
    );
    
    if (diffPixels < this.conf.pixels) {
      return null;
    }
    
    this.logger.log(`⚠️ CHANGE DETECTED: ${diffPixels} pixels`);

    const jpegBuffer = await this.native.convertRgbToJpeg(frameData.buffer, frameData.width, frameData.height);

    this.oldFrame = frameData;
    return jpegBuffer;
  }
}
