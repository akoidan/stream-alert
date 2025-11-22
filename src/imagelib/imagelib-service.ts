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
    
    try {
      console.time("nativeGetLastFrame");
      const result = this.native.getLastFrame();
      console.timeEnd("nativeGetLastFrame");
      return result;
    } catch (error) {
      this.logger.error('Error getting last frame:', error);
      return null;
    }
  }

  async getImageIfItsChanged(frameData: Buffer<ArrayBuffer>): Promise<Buffer | null> {
    if (!frameData || frameData.length === 0) {
      return null;
    }

    if (!this.processorInitialized) {
      this.logger.error('Image processor not initialized, cannot process frame');
      return null;
    }

    try {
      console.time("nativeProcessFrame");
      const result = this.native.processFrame(frameData);
      console.timeEnd("nativeProcessFrame");
      
      if (result) {
        this.logger.log(`⚠️ CHANGE DETECTED: ${result.length} bytes`);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error processing frame:', error);
      return null;
    }
  }
}
