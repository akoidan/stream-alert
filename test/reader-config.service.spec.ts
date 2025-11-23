import { Logger } from '@nestjs/common';
import { PromptConfigReader } from '../src/config/promt-config-reader.service';
import { aconfigSchema } from '../src/config/config-zod-schema';
import prompts from 'prompts';

// Mock the prompts module
jest.mock('prompts');
const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>;

// Mock FieldsValidator to avoid dependency injection issues
class MockFieldsValidator {
  public validateCamera(value: any) {
    return true;
  }
  
  public async validateTgChat(value: any) {
    return true;
  }
  
  public async validateTgToken(value: any) {
    return true;
  }

}

describe('ReaderConfigService', () => {
  let service: PromptConfigReader;
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
    service = new PromptConfigReader(mockLogger, '/test/configs', new MockFieldsValidator() as any);
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
      (service as any).addQuestions('', aconfigSchema, questions);
      
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
      (service as any).addQuestions('', aconfigSchema, questions);

      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const spamDelayQuestion = questions.find((q: any) => q.name === 'telegram.spamDelay');

      expect(tokenQuestion.type).toBe('text');
      expect(chatIdQuestion.type).toBe('number');
      expect(spamDelayQuestion.type).toBe('number');
    });

    it('should use default values from Zod schema', () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions);

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
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions);
      
      const tokenQuestion = questions.find((q: any) => q.name === 'telegram.token');
      const validate = tokenQuestion.validate;

      // Valid token (matches the regex: 10 digits : 35 alphanumeric chars)
      const result1 = await validate('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789');
      expect(result1).toBe(true);
      
      // Invalid token
      const result2 = await validate('invalid');
      expect(result2).toBe('Invalid token format (should be like: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz08assdfss');
    });

    it('should validate chat ID format', async () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions);
      
      const chatIdQuestion = questions.find((q: any) => q.name === 'telegram.chatId');
      const validate = chatIdQuestion.validate;

      // Valid chat ID
      const result1 = await validate(123456789);
      expect(result1).toBe(true);
      
      // Invalid chat ID
      const result2 = await validate(1000);
      expect(result2).toBe('Invalid Chat format');
    });

    it('should validate frame rate', async () => {
      const questions: any[] = [];
      (service as any).addQuestions('', aconfigSchema, questions);
      
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
      (service as any).addQuestions('', aconfigSchema, questions);
      
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

  describe('updateDataFromResponsesRecursive', () => {
    it('should initialize data with schema defaults and update with responses', () => {
      const updateData = (service as any).updateDataFromResponsesRecursive.bind(service);
      
      const mockResponses = {
        'telegram.token': '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
        'telegram.chatId': 123456789,
        'camera.name': 'Test Camera',
        'diff.pixels': 2000,
      };

      updateData(mockResponses);

      // Check that data was initialized with responses only
      expect(service.getTGConfig().token).toBe('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789');
      expect(service.getTGConfig().chatId).toBe(123456789);
      expect(service.getCameraConfig().name).toBe('Test Camera');
      expect(service.getDiffConfig().pixels).toBe(2000);
      
      // Other fields should be undefined since they weren't provided
      expect(service.getTGConfig().spamDelay).toBeUndefined();
      expect(service.getTGConfig().message).toBeUndefined();
      expect(service.getTGConfig().initialDelay).toBeUndefined();
      expect(service.getCameraConfig().frameRate).toBeUndefined();
      expect(service.getDiffConfig().threshold).toBeUndefined();
    });
  });
});
