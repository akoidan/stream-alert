import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ImagelibService } from '../src/imagelib/imagelib-service';
import { INativeModule, Native, FrameData } from '../src/native/native-model';
import { DiffConfData } from '../src/config/config-resolve-model';
import { DiffConfig } from '../src/config/config-zod-schema';

describe('ImagelibService', () => {
  let service: ImagelibService;
  let mockLogger: jest.Mocked<Logger>;
  let mockNative: jest.Mocked<INativeModule>;
  let mockDiffConfig: DiffConfig;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockNative = {
      convertRgbToJpeg: jest.fn(),
      compareRgbImages: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      getFrame: jest.fn(),
      listAvailableCameras: jest.fn(),
      path: '/mock/native/path',
    } as any;

    mockDiffConfig = {
      threshold: 0.1,
      pixels: 1000,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagelibService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: Native,
          useValue: mockNative,
        },
        {
          provide: DiffConfData,
          useValue: mockDiffConfig,
        },
      ],
    }).compile();

    service = module.get<ImagelibService>(ImagelibService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.conf).toBe(mockDiffConfig);
  });

  describe('getLastImage', () => {
    it('should return null when no frame is stored', async () => {
      const result = await service.getLastImage();

      expect(result).toBeNull();
      expect(mockNative.convertRgbToJpeg).not.toHaveBeenCalled();
    });

    it('should return converted JPEG when frame is stored', async () => {
      const mockFrameData: FrameData = {
        buffer: Buffer.from('fake-rgb-data'),
        width: 1920,
        height: 1080,
        dataSize: 1920 * 1080 * 3,
      };
      const mockJpegBuffer = Buffer.from('fake-jpeg-data');

      // Set the oldFrame by calling getImageIfItsChanged first
      mockNative.compareRgbImages.mockResolvedValue(mockDiffConfig.pixels + 1);
      mockNative.convertRgbToJpeg.mockResolvedValue(mockJpegBuffer);
      await service.getImageIfItsChanged(mockFrameData);

      // Clear mocks to test only getLastImage
      mockNative.convertRgbToJpeg.mockClear();

      const result = await service.getLastImage();

      expect(mockNative.convertRgbToJpeg).toHaveBeenCalledWith(
        mockFrameData.buffer,
        mockFrameData.width,
        mockFrameData.height
      );
      expect(result).toBe(mockJpegBuffer);
    });
  });

  describe('getImageIfItsChanged', () => {
    const mockFrameData: FrameData = {
      buffer: Buffer.from('fake-rgb-data'),
      width: 1920,
      height: 1080,
      dataSize: 1920 * 1080 * 3,
    };

    it('should return null for invalid frame data', async () => {
      const invalidFrame1 = null as any;
      const invalidFrame2 = { buffer: null } as any;
      const invalidFrame3 = { buffer: Buffer.alloc(0) } as any;

      const result1 = await service.getImageIfItsChanged(invalidFrame1);
      const result2 = await service.getImageIfItsChanged(invalidFrame2);
      const result3 = await service.getImageIfItsChanged(invalidFrame3);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should return null for first frame and store it', async () => {
      const result = await service.getImageIfItsChanged(mockFrameData);

      expect(result).toBeNull();
      expect(mockNative.compareRgbImages).not.toHaveBeenCalled();
      expect(mockNative.convertRgbToJpeg).not.toHaveBeenCalled();
    });

    it('should return null when diff pixels is below threshold', async () => {
      // First frame
      await service.getImageIfItsChanged(mockFrameData);

      // Second frame with low diff
      const secondFrame = {
        ...mockFrameData,
        buffer: Buffer.from('fake-rgb-data-2'),
      };
      mockNative.compareRgbImages.mockResolvedValue(mockDiffConfig.pixels - 1);

      const result = await service.getImageIfItsChanged(secondFrame);

      expect(result).toBeNull();
      expect(mockNative.compareRgbImages).toHaveBeenCalledWith(
        mockFrameData.buffer,
        secondFrame.buffer,
        secondFrame.width,
        secondFrame.height,
        mockDiffConfig.threshold
      );
      expect(mockNative.convertRgbToJpeg).not.toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should return JPEG buffer when diff pixels meets threshold', async () => {
      const mockJpegBuffer = Buffer.from('fake-jpeg-data');

      // First frame
      await service.getImageIfItsChanged(mockFrameData);

      // Second frame with high diff
      const secondFrame = {
        ...mockFrameData,
        buffer: Buffer.from('fake-rgb-data-2'),
      };
      mockNative.compareRgbImages.mockResolvedValue(mockDiffConfig.pixels);
      mockNative.convertRgbToJpeg.mockResolvedValue(mockJpegBuffer);

      const result = await service.getImageIfItsChanged(secondFrame);

      expect(result).toBe(mockJpegBuffer);
      expect(mockNative.compareRgbImages).toHaveBeenCalledWith(
        mockFrameData.buffer,
        secondFrame.buffer,
        secondFrame.width,
        secondFrame.height,
        mockDiffConfig.threshold
      );
      expect(mockNative.convertRgbToJpeg).toHaveBeenCalledWith(
        secondFrame.buffer,
        secondFrame.width,
        secondFrame.height
      );
      expect(mockLogger.log).toHaveBeenCalledWith(`⚠️ CHANGE DETECTED: ${mockDiffConfig.pixels} pixels`);
    });

    it('should return JPEG buffer when diff pixels exceeds threshold', async () => {
      const mockJpegBuffer = Buffer.from('fake-jpeg-data');
      const diffPixels = mockDiffConfig.pixels + 500;

      // First frame
      await service.getImageIfItsChanged(mockFrameData);

      // Second frame with high diff
      const secondFrame = {
        ...mockFrameData,
        buffer: Buffer.from('fake-rgb-data-2'),
      };
      mockNative.compareRgbImages.mockResolvedValue(diffPixels);
      mockNative.convertRgbToJpeg.mockResolvedValue(mockJpegBuffer);

      const result = await service.getImageIfItsChanged(secondFrame);

      expect(result).toBe(mockJpegBuffer);
      expect(mockLogger.log).toHaveBeenCalledWith(`⚠️ CHANGE DETECTED: ${diffPixels} pixels`);
    });

    it('should update oldFrame when change is detected', async () => {
      const mockJpegBuffer = Buffer.from('fake-jpeg-data');

      // First frame
      await service.getImageIfItsChanged(mockFrameData);

      // Second frame with high diff
      const secondFrame = {
        ...mockFrameData,
        buffer: Buffer.from('fake-rgb-data-2'),
      };
      mockNative.compareRgbImages.mockResolvedValue(mockDiffConfig.pixels + 1);
      mockNative.convertRgbToJpeg.mockResolvedValue(mockJpegBuffer);

      await service.getImageIfItsChanged(secondFrame);

      // Third frame should compare with second frame
      const thirdFrame = {
        ...mockFrameData,
        buffer: Buffer.from('fake-rgb-data-3'),
      };
      mockNative.compareRgbImages.mockClear();

      await service.getImageIfItsChanged(thirdFrame);

      expect(mockNative.compareRgbImages).toHaveBeenCalledWith(
        secondFrame.buffer,
        thirdFrame.buffer,
        thirdFrame.width,
        thirdFrame.height,
        mockDiffConfig.threshold
      );
    });
  });
});
