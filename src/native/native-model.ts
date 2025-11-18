interface INativeModule {
  /**
   * Initializes the capture device
   * @param deviceName - Name of the video device to capture from
   * @param frameRate - Desired frame rate for capture
   * @returns true if initialization successful, false otherwise
   */
  initialize(deviceName: string, frameRate: number): boolean;

  /**
   * Starts video capture
   * @returns true if capture started successfully, false otherwise
   */
  start(): boolean;

  /**
   * Stops video capture
   * @returns true if capture stopped successfully, false otherwise
   */
  stop(): boolean;

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

