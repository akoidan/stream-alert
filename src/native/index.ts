import * as path from 'path';

// Try to load the native module
let nativeModule: any;
try {
  const nativePath = path.join(__dirname, '../..', 'build', 'Release', 'dshow_capture.node');
  nativeModule = require(nativePath);
} catch (error) {
  console.error('Failed to load native DirectShow module:', error);
  throw new Error('DirectShow native module not found. Please run "npm run install" or "yarn install" to build it.');
}

export interface DirectShowCapture {
  initialize(deviceName: string, frameRate: number): boolean;
  start(): boolean;
  stop(): void;
  getFrame(): Buffer | null;
}

export class DirectShowCaptureService implements DirectShowCapture {
  private initialized = false;
  private running = false;

  initialize(deviceName: string, frameRate: number): boolean {
    try {
      this.initialized = nativeModule.initialize(deviceName, frameRate);
      return this.initialized;
    } catch (error) {
      console.error('Failed to initialize DirectShow capture:', error);
      return false;
    }
  }

  start(): boolean {
    if (!this.initialized) {
      throw new Error('DirectShow capture not initialized');
    }

    try {
      this.running = nativeModule.start();
      return this.running;
    } catch (error) {
      console.error('Failed to start DirectShow capture:', error);
      return false;
    }
  }

  stop(): void {
    try {
      nativeModule.stop();
      this.running = false;
      this.initialized = false;
    } catch (error) {
      console.error('Failed to stop DirectShow capture:', error);
    }
  }

  getFrame(): Buffer | null {
    if (!this.running) {
      return null;
    }

    try {
      const frame = nativeModule.getFrame();
      return frame;
    } catch (error) {
      console.error('Failed to get frame from DirectShow:', error);
      return null;
    }
  }
}

export function getVideoDevices(): string[] {
  // This would require additional native binding for device enumeration
  // For now, return empty array - device detection will happen during initialization
  return [];
}
