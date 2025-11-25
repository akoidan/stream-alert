import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app/app-module';
import { AppService } from '../src/app/app-service';
import { Telegraf } from 'telegraf';
import { Native, INativeModule } from '../src/native/native-model';
import prompts from 'prompts';

// Mock Telegraf class
jest.mock('telegraf', () => {
  return {
    Telegraf: jest.fn().mockImplementation(() => ({
      telegram: {
        getMe: jest.fn().mockResolvedValue({ id: 123, username: 'test_bot', first_name: 'Test Bot' }),
        getChat: jest.fn().mockResolvedValue({ id: 456, title: 'Test Chat' }),
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
        sendPhoto: jest.fn().mockResolvedValue({ message_id: 2 }),
        setMyCommands: jest.fn().mockResolvedValue(true),
      },
      launch: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      command: jest.fn(),
    })),
  };
});

// Mock prompts library
jest.mock('prompts', () => {
  return jest.fn().mockResolvedValue({
    'telegram.token': 'mock-telegram-token',
    'telegram.chatId': 123456789,
    'camera.deviceName': 'Mock Camera',
    'camera.frameRate': 30,
    'diff.pixels': 1000,
    'diff.threshold': 0.1,
  });
});

// Mock Native module
const mockNativeModule: INativeModule = {
  path: '/mock/path/to/native.node',
  start: jest.fn().mockImplementation((deviceName: string, frameRate: number, callback: (frameInfo: any) => void) => {
    // Fire callback immediately and then 2-3 more times to simulate frame capture
    // This prevents the 5s timeout in StreamService
    callback({
      buffer: Buffer.alloc(1920 * 1080 * 3),
      width: 1920,
      height: 1080,
      dataSize: 1920 * 1080 * 3,
    });
    
    setTimeout(() => callback({
      buffer: Buffer.alloc(1920 * 1080 * 3),
      width: 1920,
      height: 1080,
      dataSize: 1920 * 1080 * 3,
    }), 100);
    
    setTimeout(() => callback({
      buffer: Buffer.alloc(1920 * 1080 * 3),
      width: 1920,
      height: 1080,
      dataSize: 1920 * 1080 * 3,
    }), 200);
  }),
  stop: jest.fn(),
  getFrame: jest.fn().mockReturnValue({
    buffer: Buffer.alloc(1920 * 1080 * 3),
    width: 1920,
    height: 1080,
    dataSize: 1920 * 1080 * 3,
  }),
  listAvailableCameras: jest.fn().mockReturnValue([
    { displayName: 'Mock Camera', devicePath: '/dev/video0' },
  ]),
  convertRgbToJpeg: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
  compareRgbImages: jest.fn().mockResolvedValue(100),
};

describe('AppModule Functional Test', () => {
  let app: TestingModule;
  let appModule: AppModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Native)
      .useValue(mockNativeModule)
      .compile();

    appModule = app.get<AppModule>(AppModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should call onModuleInit and run successfully', async () => {
    expect(appModule).toBeDefined();
    
    // Call onModuleInit which should trigger appService.run()
    await expect(appModule.onModuleInit()).resolves.not.toThrow();
    
    // Wait a bit for the native start callbacks to fire
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify that native start was called (which fires callbacks 2-3 times)
    expect(mockNativeModule.start).toHaveBeenCalled();
  });
});
