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

  // loaded by nodejs
  path: string;
}

export const Native = 'Native';

export type {
  INativeModule,
};

