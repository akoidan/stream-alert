import { Logger } from '@nestjs/common';
import { ReaderConfigService } from './reader-config.service';
import { configSchema } from './config-zod-schema';
import prompts from 'prompts';

// Mock the prompts module
jest.mock('prompts');
const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>;

describe('ReaderConfigService', () => {
  let service: ReaderConfigService;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    // Create service instance directly with test dependencies
    service = new ReaderConfigService(mockLogger, '/test/configs');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuestionsFromSchema', () => {
    it('should create questions for all primitive fields in the schema', () => {
      // Access the private method using bracket notation
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      
      // Capture console.log output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        // Store the calls for inspection
        (consoleSpy as any).calls = (consoleSpy as any).calls || [];
        (consoleSpy as any).calls.push(args);
      });
      
      const questions = createQuestions();
      
      // Check the debug output
      const calls = (consoleSpy as any).calls || [];
      console.log('Debug calls:', calls);
      
      consoleSpy.mockRestore();

      // Should create questions for all primitive fields, not objects
      const expectedFields = [
        'telegram.token',
        'telegram.chatId', 
        'telegram.spamDelay',
        'telegram.message',
        'telegram.initialDelay',
        'camera.name',
        'camera.frameRate',
        'diff.pixels',
        'diff.threshold'
      ];

      expect(questions).toHaveLength(expectedFields.length);
      
      expectedFields.forEach(field => {
        const question = questions.find((q: any) => q.name === field);
        expect(question).toBeDefined();
        expect(question.name).toBe(field);
        expect(question.message).toBeDefined();
        expect(question.type).toBeDefined();
        expect(question.validate).toBeDefined();
      });
    });

    it('should use correct types for different field types', () => {
      // Access the private method using bracket notation
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      
      // Capture console.log output to see debug info
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        if (args[0]?.includes('spamDelay structure:')) {
          console.log('DEBUG:', args[1]); // Let us see the actual structure
        }
      });
      
      const questions = createQuestions();
      
      consoleSpy.mockRestore();

      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const spamDelayQuestion = questions.find((q: any) => q.name === 'telegram.spamDelay');

      expect(tokenQuestion.type).toBe('text');
      expect(chatIdQuestion.type).toBe('number');
      expect(spamDelayQuestion.type).toBe('number');
    });

    it('should use default values from Zod schema', () => {
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      const questions = createQuestions();

      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const spamDelayQuestion = questions.find((q: any) => q.name === 'telegram.spamDelay');

      expect(tokenQuestion.initial).toBeUndefined(); // No default for token
      expect(chatIdQuestion.initial).toBeUndefined(); // No default for chatId
      expect(spamDelayQuestion.initial).toBe(300); // Has default
    });
  });

  describe('validation', () => {
    it('should validate telegram token format', () => {
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      const questions = createQuestions();
      
      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const validate = tokenQuestion.validate;

      // Valid token (matches the regex: 10 digits : 35 alphanumeric chars)
      expect(validate('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789')).toBe(true);
      
      // Invalid token
      expect(validate('invalid')).toBe('Invalid token format (should be like: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)');
    });

    it('should validate chat ID format', () => {
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      const questions = createQuestions();
      
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const validate = chatIdQuestion.validate;

      // Valid chat ID
      expect(validate(123456789)).toBe(true);
      
      // Invalid chat ID
      expect(validate(1000)).toBe('Invalid Chat format');
    });

    it('should validate frame rate', () => {
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      const questions = createQuestions();
      
      const frameRateQuestion = questions.find((q: any) => q.name === 'camera.frameRate');
      const validate = frameRateQuestion.validate;

      // Valid frame rate
      expect(validate(5)).toBe(true);
      
      // Invalid frame rate
      expect(validate(0)).toBe('Frame rate must be positive');
      expect(validate(-1)).toBe('Frame rate must be positive');
    });

    it('should validate threshold range', () => {
      const createQuestions = (service as any).createQuestionsFromSchema.bind(service);
      const questions = createQuestions();
      
      const thresholdQuestion = questions.find((q: any) => q.name === 'diff.threshold');
      const validate = thresholdQuestion.validate;

      // Valid threshold
      expect(validate(0.5)).toBe(true);
      expect(validate(0.0)).toBe(true);
      expect(validate(1.0)).toBe(true);
      
      // Invalid threshold
      expect(validate(-0.1)).toBe('Threshold must be at least 0.0');
      expect(validate(1.1)).toBe('Threshold must be at most 1.0');
    });
  });

  describe('helper functions', () => {
    it('should get nested values correctly', () => {
      const getNestedValue = (service as any).getNestedValue.bind(service);
      
      const obj = {
        telegram: {
          token: 'test-token',
          chatId: 123456
        }
      };

      expect(getNestedValue(obj, ['telegram', 'token'])).toBe('test-token');
      expect(getNestedValue(obj, ['telegram', 'chatId'])).toBe(123456);
      expect(getNestedValue(obj, ['telegram', 'nonexistent'])).toBeUndefined();
    });

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

    it('should handle getInitial correctly', () => {
      const getInitial = (service as any).getInitial.bind(service);
      
      expect(getInitial('test-value')).toBe('test-value');
      expect(getInitial(0)).toBe(0);
      expect(getInitial(300)).toBe(300);
      expect(getInitial('')).toBe('');
      expect(getInitial(undefined)).toBeUndefined();
    });
  });

  describe('updateDataFromResponsesRecursive', () => {
    it('should initialize data with schema defaults and update with responses', () => {
      const updateData = (service as any).updateDataFromResponsesRecursive.bind(service);
      
      const mockResponses = {
        'telegram.token': '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
        'telegram.chatId': 123456789,
        'camera.name': 'Test Camera',
        'diff.pixels': 2000,
      };

      updateData(mockResponses);

      // Check that data was initialized with defaults and updated with responses
      expect(service.getTGConfig().token).toBe('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
      expect(service.getTGConfig().chatId).toBe(123456789);
      expect(service.getTGConfig().spamDelay).toBe(300); // Default value
      expect(service.getCameraConfig().name).toBe('Test Camera');
      expect(service.getCameraConfig().frameRate).toBe(1); // Default value
      expect(service.getDiffConfig().pixels).toBe(2000);
      expect(service.getDiffConfig().threshold).toBe(0.1); // Default value
    });
  });
});
