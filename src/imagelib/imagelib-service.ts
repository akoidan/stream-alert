import {Injectable, Logger} from '@nestjs/common';
import {INativeModule} from '@/native/native-model';


@Injectable()
export class ImagelibService {
  private processorInitialized: boolean = false;

  constructor(
    private readonly logger: Logger,
    private readonly native: INativeModule,
    private readonly threshold: number,
    public diffThreshold: number,
  ) {
  }

  public initializeProcessor(): void {
    this.native.createProcessor();
    this.processorInitialized = true;
    this.logger.log('✅ Native image processor initialized');
  }

  async getLastImage(): Promise<Buffer | null> {
    if (!this.processorInitialized) {
      this.logger.warn('Image processor not initialized');
      return null;
    }

    console.time("nativeGetLastFrame");
    const result = this.native.getLastFrame();
    console.timeEnd("nativeGetLastFrame");
    return result;

  }

  async getImageIfItsChanged(frameData: Buffer<ArrayBuffer>): Promise<Buffer | null> {
    if (!frameData || frameData.length === 0) {
      return null;
    }

    const result = this.native.processFrame(frameData);

    if (result) {
      this.logger.log(`⚠️ CHANGE DETECTED: ${result.length} bytes`);
    }
    return result;
  }
}
