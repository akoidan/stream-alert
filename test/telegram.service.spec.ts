import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TelegramService } from '../src/telegram/telegram-service';
import { Telegraf } from 'telegraf';
import { TelegramConfigData } from '../src/config/config-resolve-model';
import { TelegramConfig } from '../src/config/config-zod-schema';
import { TelegramCommands } from '../src/telegram/telegram-model';
import type { TgCommandsExecutor } from '../src/app/app-model';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockLogger: jest.Mocked<Logger>;
  let mockBot: jest.Mocked<Telegraf>;
  let mockTgConfig: TelegramConfig;
  let mockCommandListener: jest.Mocked<TgCommandsExecutor>;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockBot = {
      telegram: {
        setMyCommands: jest.fn(),
        getMe: jest.fn().mockResolvedValue({
          username: 'testbot',
          first_name: 'Test Bot',
        }),
        sendMessage: jest.fn(),
        sendPhoto: jest.fn(),
      },
      command: jest.fn(),
      launch: jest.fn(),
    } as any;

    mockTgConfig = {
      token: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz08assdfss',
      chatId: 123456789,
      spamDelay: 300,
      message: 'Changes detected',
      initialDelay: 10,
    };

    mockCommandListener = {
      onAskImage: jest.fn(),
      onSetThreshold: jest.fn(),
      onIncreaseThreshold: jest.fn(),
      onDecreaseThreshold: jest.fn(),
      onNewFrame: jest.fn(),
    } as any;

    // Use fake timers for telegram service tests
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: Telegraf,
          useValue: mockBot,
        },
        {
          provide: TelegramConfigData,
          useValue: mockTgConfig,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setup', () => {
    it('should setup bot commands and start listening', async () => {
      await service.setup(mockCommandListener);

      expect(mockLogger.log).toHaveBeenCalledWith('Starting telegram service');
      expect(mockBot.telegram.setMyCommands).toHaveBeenCalledWith([
        { command: TelegramCommands.image, description: 'Get the last image' },
        {
          command: TelegramCommands.set_threshold,
          description: 'Sets new amount of pixels to be changes to fire a notification',
        },
        {
          command: TelegramCommands.increase_threshold,
          description: 'Double the amount of pixels related to current value to spot a diff',
        },
        {
          command: TelegramCommands.decrease_threshold,
          description: 'Reduces the amount of pixels related to current value to spot a diff',
        },
      ]);
      expect(mockBot.command).toHaveBeenCalledWith(TelegramCommands.image, expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith(TelegramCommands.set_threshold, expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith(TelegramCommands.increase_threshold, expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith(TelegramCommands.decrease_threshold, expect.any(Function));
      expect(mockBot.launch).toHaveBeenCalled();
    });

    it('should throw error when token validation fails', async () => {
      // Create a new mock bot that rejects for this test
      const errorBot = {
        ...mockBot,
        telegram: {
          ...mockBot.telegram,
          getMe: jest.fn().mockRejectedValue(new Error('Invalid token')),
        },
      };

      const errorModule: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: Logger,
            useValue: mockLogger,
          },
          {
            provide: Telegraf,
            useValue: errorBot,
          },
          {
            provide: TelegramConfigData,
            useValue: mockTgConfig,
          },
        ],
      }).compile();

      const errorService = errorModule.get<TelegramService>(TelegramService);

      await expect(errorService.setup(mockCommandListener)).rejects.toThrow(
        'Telegram token validation failed. Please check your bot token.'
      );
    });
  });

  describe('sendText', () => {
    it('should send text message to configured chat', async () => {
      const message = 'Test message';

      await service.sendText(message);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(mockTgConfig.chatId, message);
    });
  });

  describe('sendImage', () => {
    it('should send image when not in spam period', async () => {
      const imageData = Buffer.from('fake-image-data');

      // Wait past initial delay
      jest.advanceTimersByTime(mockTgConfig.initialDelay * 1000 + 1000);

      await service.sendImage(imageData);

      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledWith(
        mockTgConfig.chatId,
        { source: imageData },
        { caption: mockTgConfig.message }
      );
      expect(mockLogger.log).toHaveBeenCalledWith('Notification sent');
    });

    it('should not send image during initial delay', async () => {
      const imageData = Buffer.from('fake-image-data');
      // Reset service to simulate fresh start
      const freshService = new (TelegramService as any)(mockLogger, mockBot, mockTgConfig);

      await freshService.sendImage(imageData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        `Awaiting startup delay ${mockTgConfig.initialDelay}s before sending notification`
      );
      expect(mockBot.telegram.sendPhoto).not.toHaveBeenCalled();
    });

    it('should not send image during spam delay period', async () => {
      const imageData = Buffer.from('fake-image-data');

      // Wait past initial delay
      jest.advanceTimersByTime(mockTgConfig.initialDelay * 1000 + 1000);

      // Send first image
      await service.sendImage(imageData);
      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledTimes(1);

      // Try to send second image immediately
      await service.sendImage(imageData);

      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Awaiting')
      );
    });

    it('should send image after spam delay period', async () => {
      const imageData = Buffer.from('fake-image-data');

      // Wait past initial delay
      jest.advanceTimersByTime(mockTgConfig.initialDelay * 1000 + 1000);

      // Send first image
      await service.sendImage(imageData);
      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledTimes(1);

      // Advance time past spam delay
      jest.advanceTimersByTime(mockTgConfig.spamDelay * 1000 + 1000);

      // Send second image
      await service.sendImage(imageData);

      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledTimes(2);
    });
  });
});
