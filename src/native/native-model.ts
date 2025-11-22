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
   * Initialize the image processor for processing frames
   */
  createProcessor(): void;

  /**
   * Process a BMP frame and return JPEG if changed significantly
   * @param frameData - Buffer containing BMP image data (24-bit format)
   * @returns Buffer containing JPEG data if frame changed, null if no significant change
   */
  processFrame(frameData: Buffer): Buffer | null;

  /**
   * Get the last processed frame as JPEG
   * @returns Buffer containing JPEG data of last frame, null if no frame processed
   */
  getLastFrame(): Buffer | null;

  // loaded by nodejs
  path: string;
}

export const Native = 'Native';

export type {
  INativeModule,
};

