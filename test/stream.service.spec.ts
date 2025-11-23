import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { StreamService } from '../src/stream/stream-service';
import { INativeModule, Native } from '../src/native/native-model';
import { CameraConfData } from '../src/config/config-resolve-model';
import { CameraConfig } from '../src/config/config-zod-schema';
import type { FrameDetector } from '../src/app/app-model';

describe('StreamService', () => {
  let service: StreamService;
  let mockLogger: jest.Mocked<Logger>;
  let mockCaptureService: jest.Mocked<INativeModule>;
  let mockCameraConfig: CameraConfig;
  let mockFrameListener: jest.Mocked<FrameDetector>;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockCaptureService = {
      start: jest.fn(),
      stop: jest.fn(),
      getFrame: jest.fn(),
      listAvailableCameras: jest.fn(),
      convertRgbToJpeg: jest.fn(),
      compareRgbImages: jest.fn(),
      path: '/mock/native/path',
    } as any;

    mockCameraConfig = {
      name: 'Test Camera',
      frameRate: 30,
    };

    mockFrameListener = {
      onNewFrame: jest.fn(),
    } as any;

    // Use fake timers to control setTimeout behavior
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: Native,
          useValue: mockCaptureService,
        },
        {
          provide: CameraConfData,
          useValue: mockCameraConfig,
        },
      ],
    }).compile();

    service = module.get<StreamService>(StreamService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listen', () => {
    it('should start capture with callback and setup timeout', async () => {
      let captureCallback: (frameInfo: any) => void;

      mockCaptureService.start.mockImplementation((deviceName, frameRate, callback) => {
        captureCallback = callback;
      });

      await service.listen(mockFrameListener);

      expect(mockCaptureService.start).toHaveBeenCalledWith(
        mockCameraConfig.name,
        mockCameraConfig.frameRate,
        expect.any(Function)
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        `DirectShow capture started for device: ${mockCameraConfig.name}`
      );

      // Verify timeout is set by checking that timers exist
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should handle frame data and reset timeout', async () => {
      let captureCallback: (frameInfo: any) => void | undefined;
      const mockFrameData = {
        buffer: Buffer.from('fake-frame-data'),
        width: 1920,
        height: 1080,
        dataSize: 1920 * 1080 * 3,
      };

      mockCaptureService.start.mockImplementation((deviceName, frameRate, callback) => {
        captureCallback = callback;
      });

      await service.listen(mockFrameListener);

      // Clear the initial timeout setup
      jest.clearAllTimers();

      // Simulate receiving frame data
      captureCallback!(mockFrameData);

      expect(mockFrameListener.onNewFrame).toHaveBeenCalledWith(mockFrameData);
      // Verify timeout is reset by checking timer count
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should not call frame listener when frame info is null', async () => {
      let captureCallback: (frameInfo: any) => void | undefined;

      mockCaptureService.start.mockImplementation((deviceName, frameRate, callback) => {
        captureCallback = callback;
      });

      await service.listen(mockFrameListener);

      // Clear the initial timeout setup
      jest.clearAllTimers();

      // Simulate receiving null frame data
      captureCallback!(null);

      expect(mockFrameListener.onNewFrame).not.toHaveBeenCalled();
      // Verify timeout is set
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should throw error when no frame data received within timeout', async () => {
      mockCaptureService.start.mockImplementation(() => {
        // Don't call the callback to simulate no frame data
      });

      // We need to wrap this in a try-catch because the error is thrown synchronously
      expect(() => {
        service.listen(mockFrameListener);
        jest.advanceTimersByTime(5000);
      }).toThrow('Frame capturing didn\'t produce any data for 5s, exiting...');
    });

    it('should reset timeout on each frame received', async () => {
      let captureCallback: (frameInfo: any) => void | undefined;
      const mockFrameData = {
        buffer: Buffer.from('fake-frame-data'),
        width: 1920,
        height: 1080,
        dataSize: 1920 * 1080 * 3,
      };

      mockCaptureService.start.mockImplementation((deviceName, frameRate, callback) => {
        captureCallback = callback;
      });

      service.listen(mockFrameListener);

      // Clear the initial timeout setup
      jest.clearAllTimers();

      // Send first frame
      captureCallback!(mockFrameData);
      expect(mockFrameListener.onNewFrame).toHaveBeenCalledTimes(1);

      // Send second frame before timeout
      jest.advanceTimersByTime(4000);
      captureCallback!(mockFrameData);
      expect(mockFrameListener.onNewFrame).toHaveBeenCalledTimes(2);

      // Should not have thrown error yet
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Advance past timeout without new frame should trigger error
      jest.advanceTimersByTime(1000);
      
      // The service should still be running, so we expect no immediate error
      // The timeout would be reset by the last frame
      expect(mockFrameListener.onNewFrame).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});
