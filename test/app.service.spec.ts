import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AppService } from '../src/app/app-service';
import { StreamService } from '../src/stream/stream-service';
import { TelegramService } from '../src/telegram/telegram-service';
import { ImagelibService } from '../src/imagelib/imagelib-service';
import { CommandContextExtn } from 'telegraf/typings/telegram-types';
import { FrameData } from '../src/native/native-model';

describe('AppService', () => {
  let service: AppService;
  let mockLogger: jest.Mocked<Logger>;
  let mockStreamService: jest.Mocked<StreamService>;
  let mockTelegramService: jest.Mocked<TelegramService>;
  let mockImagelibService: jest.Mocked<ImagelibService>;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockStreamService = {
      listen: jest.fn(),
    } as any;

    mockTelegramService = {
      setup: jest.fn(),
      sendText: jest.fn(),
      sendImage: jest.fn(),
    } as any;

    mockImagelibService = {
      conf: {
        threshold: 100,
      },
      getLastImage: jest.fn(),
      getImageIfItsChanged: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: StreamService,
          useValue: mockStreamService,
        },
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: ImagelibService,
          useValue: mockImagelibService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onIncreaseThreshold', () => {
    it('should double the threshold and send notification', async () => {
      const initialThreshold = 100;
      mockImagelibService.conf.threshold = initialThreshold;

      await service.onIncreaseThreshold();

      expect(mockImagelibService.conf.threshold).toBe(initialThreshold * 2);
      expect(mockTelegramService.sendText).toHaveBeenCalledWith(`Increase threshold to ${initialThreshold * 2}`);
    });
  });

  describe('onDecreaseThreshold', () => {
    it('should halve the threshold and send notification', async () => {
      const initialThreshold = 100;
      mockImagelibService.conf.threshold = initialThreshold;

      await service.onDecreaseThreshold();

      expect(mockImagelibService.conf.threshold).toBe(Math.ceil(initialThreshold / 2));
      expect(mockTelegramService.sendText).toHaveBeenCalledWith(`Decreased threshold to ${Math.ceil(initialThreshold / 2)}`);
    });
  });

  describe('onAskImage', () => {
    it('should send image when available', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockImagelibService.getLastImage.mockResolvedValue(mockImageBuffer);

      await service.onAskImage();

      expect(mockLogger.log).toHaveBeenCalledWith('Got image command');
      expect(mockImagelibService.getLastImage).toHaveBeenCalled();
      expect(mockTelegramService.sendImage).toHaveBeenCalledWith(mockImageBuffer);
    });

    it('should send no image message when no image available', async () => {
      mockImagelibService.getLastImage.mockResolvedValue(null);

      await service.onAskImage();

      expect(mockLogger.log).toHaveBeenCalledWith('Got image command');
      expect(mockImagelibService.getLastImage).toHaveBeenCalled();
      expect(mockTelegramService.sendText).toHaveBeenCalledWith('No image in cache');
      expect(mockLogger.log).toHaveBeenCalledWith('No current image found, skipping');
    });
  });

  describe('onSetThreshold', () => {
    it('should set threshold when valid number provided', async () => {
      const mockContext: CommandContextExtn = {
        payload: '150',
      } as any;

      await service.onSetThreshold(mockContext);

      expect(mockImagelibService.conf.threshold).toBe(150);
      expect(mockTelegramService.sendText).not.toHaveBeenCalled();
    });

    it('should send error message when invalid number provided', async () => {
      const mockContext: CommandContextExtn = {
        payload: 'invalid',
      } as any;

      await service.onSetThreshold(mockContext);

      expect(mockTelegramService.sendText).toHaveBeenCalledWith(
        'set_threshold required number parameter. invalid is not a number'
      );
    });

    it('should not set threshold when zero or negative provided', async () => {
      const mockContext: CommandContextExtn = {
        payload: '0',
      } as any;
      const initialThreshold = mockImagelibService.conf.threshold;

      await service.onSetThreshold(mockContext);

      expect(mockImagelibService.conf.threshold).toBe(initialThreshold);
      expect(mockTelegramService.sendText).toHaveBeenCalledWith(
        'set_threshold required number parameter. 0 is not a number'
      );
    });
  });

  describe('onNewFrame', () => {
    it('should send image when frame has changed', async () => {
      const mockFrameData: FrameData = {
        buffer: Buffer.from('fake-frame-data'),
        width: 1920,
        height: 1080,
        dataSize: 1920 * 1080 * 3,
      };
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockImagelibService.getImageIfItsChanged.mockResolvedValue(mockImageBuffer);

      await service.onNewFrame(mockFrameData);

      expect(mockImagelibService.getImageIfItsChanged).toHaveBeenCalledWith(mockFrameData);
      expect(mockTelegramService.sendImage).toHaveBeenCalledWith(mockImageBuffer);
    });

    it('should not send image when frame has not changed', async () => {
      const mockFrameData: FrameData = {
        buffer: Buffer.from('fake-frame-data'),
        width: 1920,
        height: 1080,
        dataSize: 1920 * 1080 * 3,
      };
      mockImagelibService.getImageIfItsChanged.mockResolvedValue(null);

      await service.onNewFrame(mockFrameData);

      expect(mockImagelibService.getImageIfItsChanged).toHaveBeenCalledWith(mockFrameData);
      expect(mockTelegramService.sendImage).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('should start stream service and setup telegram', async () => {
      await service.run();

      expect(mockStreamService.listen).toHaveBeenCalledWith(service);
      expect(mockTelegramService.setup).toHaveBeenCalledWith(service);
    });
  });
});
