import {Injectable, Logger} from '@nestjs/common';
import {INativeModule} from '@/native/native-model';


@Injectable()
export class ImagelibService {
  private oldFrame: Buffer | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly native: INativeModule,
    private readonly threshold: number,
    public diffThreshold: number,
  ) {
  }

  async getLastImage(): Promise<Buffer | null> {
    if (!this.oldFrame) {
      return null;
    }

    console.time("nativeConvertBmpToJpeg");
    const result = this.native.convertBmpToJpeg(this.oldFrame);
    console.timeEnd("nativeConvertBmpToJpeg");
    return result;
  }

  async getImageIfItsChanged(frameData: Buffer<ArrayBuffer>): Promise<Buffer | null> {
    if (!frameData || frameData.length === 0) {
      return null;
    }

    if (!this.oldFrame) {
      this.oldFrame = frameData;
      return null;
    }

    console.time("compareBmpImages");
    const diffPixels = this.native.compareBmpImages(this.oldFrame, frameData, this.threshold);
    console.timeEnd("compareBmpImages");
    if (diffPixels < this.diffThreshold) {
      return null
    }
    this.logger.log(`⚠️ CHANGE DETECTED: ${diffPixels} pixels`);

    console.time("convertBmpToJpeg");
    const jpegBuffer = this.native.convertBmpToJpeg(frameData);
    console.timeEnd("convertBmpToJpeg");

    this.oldFrame = frameData;
    return jpegBuffer;
  }
}
