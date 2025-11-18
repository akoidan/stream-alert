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

    // Check if this is raw RGB data (DirectShow RGB24)
    // For now, assume 640x480 RGB24 format
    const frameWidth = 640;
    const frameHeight = 480;
    const expectedSize = frameWidth * frameHeight * 3;
    
    let newFrame: any;
    
    if (frameData.length === expectedSize) {
      // Raw RGB24 data - convert to Jimp
      newFrame = new Jimp({width: frameWidth, height: frameHeight});
      
      // Copy RGB data to Jimp bitmap (Jimp uses RGBA format)
      const rgbaData = newFrame.bitmap.data as Uint8Array;
      const rgbData = frameData as Uint8Array;
      
      for (let i = 0; i < frameWidth * frameHeight; i++) {
        const srcIndex = i * 3; // RGB
        const destIndex = i * 4; // RGBA
        rgbaData[destIndex] = rgbData[srcIndex];     // R
        rgbaData[destIndex + 1] = rgbData[srcIndex + 1]; // G
        rgbaData[destIndex + 2] = rgbData[srcIndex + 2]; // B
        rgbaData[destIndex + 3] = 255; // A (fully opaque)
      }
    } else {
      // Assume it's a valid image format (JPEG/PNG/etc)
      newFrame = await Jimp.read(frameData);
    }

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
