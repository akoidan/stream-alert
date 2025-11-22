interface FrameData {
  buffer: Buffer;
  width: number;
  height: number;
  dataSize: number;
}

interface INativeModule {
  /**
   * Starts video capture with callback
   * @param deviceName - Name of the video device to capture from
   * @param frameRate - Desired frame rate for capture
   * @param callback - Function called when new frames are available
   */
  start(deviceName: string, frameRate: number, callback: (frameInfo: any) => void): void;

  /**
   * Stops video capture
   */
  stop(): void;

  /**
   * Gets the latest captured frame
   * @returns FrameData object with RGB buffer and dimensions, or null if no frame available
   */
  getFrame(): FrameData | null;

  // High-Performance RGB Functions
  /**
   * Convert RGB image buffer to JPEG buffer asynchronously
   * @param rgbBuffer - Buffer containing RGB image data
   * @param width - Image width in pixels
   * @param height - Image height in pixels
   * @returns Promise<Buffer> containing JPEG data
   * @throws Error if conversion fails
   */
  convertRgbToJpeg(rgbBuffer: Buffer, width: number, height: number): Promise<Buffer>;

  /**
   * Compare two RGB images and count different pixels asynchronously
   * @param rgbBuffer1 - Buffer containing first RGB image data
   * @param rgbBuffer2 - Buffer containing second RGB image data
   * @param width - Image width in pixels
   * @param height - Image height in pixels
   * @param threshold - Threshold for pixel difference (0-1, similar to pixelmatch)
   * @returns Promise<number> containing the number of different pixels
   * @throws Error if comparison fails
   */
  compareRgbImages(rgbBuffer1: Buffer, rgbBuffer2: Buffer, width: number, height: number, threshold: number): Promise<number>;

  // loaded by nodejs
  path: string;
}

export const Native = 'Native';

export type {
  INativeModule,
  FrameData,
};

