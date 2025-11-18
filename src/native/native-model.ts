interface INativeModule {
  /**
   * Initializes the capture device
   * @param deviceName - Name of the video device to capture from
   * @param frameRate - Desired frame rate for capture
   */
  initialize(deviceName: string, frameRate: number): void;

  /**
   * Starts video capture
   */
  start(): void;

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

