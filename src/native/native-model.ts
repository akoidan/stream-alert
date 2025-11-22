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
   * @returns Buffer containing JPEG frame data, or null if no frame available
   */
  getFrame(): Buffer | null;

  /**
   * Convert BMP image buffer to JPEG buffer
   * @param bmpBuffer - Buffer containing BMP image data (24-bit format)
   * @returns Buffer containing JPEG data
   * @throws Error if conversion fails
   */
  convertBmpToJpeg(bmpBuffer: Buffer): Buffer;

  /**
   * Compare two BMP images and count different pixels
   * @param bmpBuffer1 - Buffer containing first BMP image data
   * @param bmpBuffer2 - Buffer containing second BMP image data
   * @param threshold - Threshold for pixel difference (0-1, similar to pixelmatch)
   * @returns Number of different pixels
   * @throws Error if comparison fails
   */
  compareBmpImages(bmpBuffer1: Buffer, bmpBuffer2: Buffer, threshold: number): number;

  // loaded by nodejs
  path: string;
}

export const Native = 'Native';

export type {
  INativeModule,
};

