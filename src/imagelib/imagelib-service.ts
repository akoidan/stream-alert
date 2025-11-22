import {Injectable, Logger} from '@nestjs/common';
import {FrameData, INativeModule} from '@/native/native-model';


@Injectable()
export class ImagelibService {
  private oldFrame: FrameData | null = null;

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

    console.time("convertRgbToJpeg");
    const result = this.native.convertRgbToJpeg(this.oldFrame.buffer, this.oldFrame.width, this.oldFrame.height);
    console.timeEnd("convertRgbToJpeg");
    return result;
  }

  async getImageIfItsChanged(frameData: FrameData): Promise<Buffer | null> {
    if (!frameData || !frameData.buffer || frameData.buffer.length === 0) {
      return null;
    }

    if (!this.oldFrame) {
      this.oldFrame = frameData;
      return null;
    }

    console.time("compareRgbImages");
    const diffPixels = this.native.compareRgbImages(
      this.oldFrame.buffer, 
      frameData.buffer, 
      frameData.width, 
      frameData.height, 
      this.threshold
    );
    console.timeEnd("compareRgbImages");
    
    if (diffPixels < this.diffThreshold) {
      return null;
    }
    
    this.logger.log(`⚠️ CHANGE DETECTED: ${diffPixels} pixels`);

    console.time("convertRgbToJpeg");
    const jpegBuffer = this.native.convertRgbToJpeg(frameData.buffer, frameData.width, frameData.height);
    console.timeEnd("convertRgbToJpeg");

    this.oldFrame = frameData;
    return jpegBuffer;
  }
}
