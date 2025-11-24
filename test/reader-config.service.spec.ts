import { Logger } from '@nestjs/common';
import { PromptConfigReader } from '../src/config/promt-config-reader.service';
import { aconfigSchema } from '../src/config/config-zod-schema';
import prompts from 'prompts';
import { INativeModule } from '../src/native/native-model';
import { Telegraf } from 'telegraf';

// Mock the prompts module
jest.mock('prompts');
const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>;

// Mock native module
class MockNativeModule implements INativeModule {
  path = '/mock/native/path';
  start = jest.fn();
  stop = jest.fn();
  getFrame = jest.fn();
  listAvailableCameras = jest.fn().mockReturnValue([
    { name: 'Test Camera 1', path: '/dev/video0' },
    { name: 'Test Camera 2', path: '/dev/video1' }
  ]);
  convertRgbToJpeg = jest.fn();
  compareRgbImages = jest.fn();
}

// Mock Telegraf getter
const mockTelegrafGetter = jest.fn().mockImplementation((token: string) => {
  if (token === 'invalid') {
    return {
      telegram: {
        getMe: jest.fn().mockRejectedValue(new Error('Invalid token')),
        getChat: jest.fn().mockRejectedValue(new Error('Chat not found'))
      }
    };
  }
  
  if (token === '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789') {
    return {
      telegram: {
        getMe: jest.fn().mockResolvedValue({ username: 'testbot' }),
        getChat: jest.fn().mockImplementation((chatId: number) => {
          if (chatId === 999999999) {
            return Promise.reject(new Error('ChatID not found'));
          }
          return Promise.resolve({ id: chatId });
        })
      }
    };
  }
  
  return {
    telegram: {
      getMe: jest.fn().mockResolvedValue({ username: 'testbot' }),
      getChat: jest.fn().mockResolvedValue({ id: 123456789 })
    }
  };
});

describe('ReaderConfigService', () => {
  let service: PromptConfigReader;
  let mockLogger: jest.Mocked<Logger>;
  let mockNative: MockNativeModule;
  let mockPlatform: NodeJS.Platform;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockNative = new MockNativeModule();
    mockPlatform = 'linux';

    // Create service instance directly with test dependencies
    service = new PromptConfigReader(
      mockLogger,
      mockNative as any,
      mockPlatform,
      mockTelegrafGetter as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuestionsFromSchema', () => {
    it('should create questions for all primitive fields in the schema', () => {
      // Use the addQuestions method directly since createQuestionsFromSchema was removed
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions, []);
      
      expect(questions.length).toBeGreaterThan(0);
      
      // Check that we have questions for all expected fields
      const fieldNames = questions.map((q: any) => q.name);
      expect(fieldNames).toContain('telegram.token');
      expect(fieldNames).toContain('telegram.chatId');
      expect(fieldNames).toContain('telegram.spamDelay');
      expect(fieldNames).toContain('camera.name');
      expect(fieldNames).toContain('camera.frameRate');
      expect(fieldNames).toContain('diff.pixels');
      expect(fieldNames).toContain('diff.threshold');
    });

    it('should use correct types for different field types', () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions, []);

      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const spamDelayQuestion = questions.find((q: any) => q.name === 'telegram.spamDelay');

      expect(tokenQuestion.type).toBe('text');
      expect(chatIdQuestion.type).toBe('number');
      expect(spamDelayQuestion.type).toBe('number');
    });

    it('should use default values from Zod schema', () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions, []);

      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const spamDelayQuestion = questions.find((q: any) => q.name === 'telegram.spamDelay');

      expect(tokenQuestion.initial).toBeUndefined(); // No default for token
      expect(chatIdQuestion.initial).toBeUndefined(); // No default for chatId
      expect(spamDelayQuestion.initial).toBe(300); // Has default
    });
  });

  describe('validation', () => {
    it('should validate telegram token format', async () => {
      // Test the service's validateTgToken method directly
      const result1 = await service.validateTgToken('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789');
      expect(result1).toBe(true);
      
      // Test invalid token
      const result2 = await service.validateTgToken('invalid');
      expect(result2).toBe('Invalid token');
    });

    it('should validate chat ID format', async () => {
      // First set a valid token to enable chat validation
      await service.validateTgToken('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789');
      
      // Test the service's validateTgChat method directly
      const result1 = await service.validateTgChat(123456789);
      expect(result1).toBe(true);
      
      // Test invalid chat ID
      const result2 = await service.validateTgChat(999999999);
      expect(result2).toBe('ChatID not found');
    });

    it('should validate frame rate', async () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions, []);
      
      const frameRateQuestion = questions.find((q: any) => q.name === 'camera.frameRate');
      const validate = frameRateQuestion.validate;

      // Valid frame rate
      const result1 = await validate(5);
      expect(result1).toBe(true);
      
      // Invalid frame rate
      const result2 = await validate(0);
      expect(result2).toBe('Frame rate must be positive');
      const result3 = await validate(-1);
      expect(result3).toBe('Frame rate must be positive');
    });

    it('should validate threshold range', async () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions, []);
      
      const thresholdQuestion = questions.find((q: any) => q.name === 'diff.threshold');
      const validate = thresholdQuestion.validate;

      // Valid threshold
      const result1 = await validate(0.5);
      expect(result1).toBe(true);
      const result2 = await validate(0.0);
      expect(result2).toBe(true);
      const result3 = await validate(1.0);
      expect(result3).toBe(true);
      
      // Invalid threshold
      const result4 = await validate(-0.1);
      expect(result4).toBe('Threshold must be at least 0.0');
      const result5 = await validate(1.1);
      expect(result5).toBe('Threshold must be at most 1.0');
    });
  });

  describe('helper functions', () => {
    it('should set nested values correctly', () => {
      const setNestedValue = (service as any).setNestedValue.bind(service);
      
      const obj = {};
      
      setNestedValue(obj, ['telegram', 'token'], 'test-token');
      setNestedValue(obj, ['telegram', 'chatId'], 123456);
      
      expect(obj).toEqual({
        telegram: {
          token: 'test-token',
          chatId: 123456
        }
      });
    });
  });

  describe('load method integration', () => {
    it('should load complete configuration successfully', async () => {
      // Mock responses for all fields
      const mockResponses = {
        'telegram.token': '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
        'telegram.chatId': 123456789,
        'telegram.spamDelay': 600,
        'telegram.message': 'Custom message',
        'telegram.initialDelay': 15,
        'camera.name': 'Test Camera 1',
        'camera.frameRate': 10,
        'diff.pixels': 2000,
        'diff.threshold': 0.2,
      };

      // Mock prompts to return responses with correct length property
      mockedPrompts.mockImplementation((questions: any) => {
        const responses = { ...mockResponses };
        // Set the length property to match the number of questions
        Object.defineProperty(responses, 'length', {
          value: Array.isArray(questions) ? questions.length : 1,
          enumerable: false
        });
        return Promise.resolve(responses);
      });

      const result = await service.load();

      expect(result).toEqual({
        telegram: {
          token: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
          chatId: 123456789,
          spamDelay: 600,
          message: 'Custom message',
          initialDelay: 15,
        },
        camera: {
          name: 'Test Camera 1',
          frameRate: 10,
        },
        diff: {
          pixels: 2000,
          threshold: 0.2,
        },
      });

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('🤖 First, create a Telegram bot'));
    });
  });
});
