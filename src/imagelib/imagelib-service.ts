import {Injectable, Logger} from '@nestjs/common';
import {Jimp, JimpInstance} from "jimp";
import pixelmatch from "pixelmatch";

@Injectable()
export class ImagelibService {
  private oldFrame: JimpInstance | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly threshold: number,
    public diffThreshold: number,
  ) {
  }

  async getLastImage(): Promise<Buffer | null> {
    if (this.oldFrame) {
      return this.oldFrame.getBuffer('image/jpeg');
    }
    return null;
  }

  async getImageIfItsChanged(frameData: Buffer<ArrayBuffer>): Promise<Buffer | null> {
    if (!frameData || frameData.length === 0) {
      return null;
    }

    
    let newFrame: JimpInstance = await Jimp.read(frameData) as JimpInstance;

    if (!this.oldFrame) {
      this.oldFrame = newFrame;
      return null;
    }
    const {width, height} = newFrame.bitmap;

    const diffPixels = pixelmatch(
      newFrame.bitmap.data as Uint8Array,
      this.oldFrame.bitmap.data as Uint8Array,
      null!,
      width,
      height,
      {threshold: this.threshold}
    );
    this.oldFrame = newFrame as JimpInstance;

    if (diffPixels > this.diffThreshold) {
      this.logger.log(`⚠️ CHANGE DETECTED: ${diffPixels}`);
      return await newFrame.getBuffer('image/jpeg');
    } else {
      return null
    }
  }
}
