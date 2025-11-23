import {Injectable, Logger} from '@nestjs/common';
import {CameraConfig, configSchema, DiffConfig, TelegramConfig} from "@/config/config-zod-schema";
import {SimpleConfigService} from "@/config/simple-config.service";
import prompts from 'prompts';

@Injectable()
export class ReaderConfigService extends SimpleConfigService {

  constructor(
    logger: Logger,
    configsPath: string
  ) {
    super(logger, configsPath)
  }

  public async load() {
    try {
      await super.load()
    } catch (e) {
      this.logger.warn(`Can't find config file at ${this.confPath}`);
      
      // Initialize with default values and prompt user for configuration
      await this.promptForConfiguration();
    }
  }

  private async promptForConfiguration() {
    this.logger.log('\n🤖 First, create a Telegram bot:\n'
      + '  1. Open @BotFather in Telegram\n'
      + '  2. Send /newbot and follow the instructions\n'
      + '  3. Save the bot token for the next step\n');

    const questions = this.createQuestionsFromSchema();
    const responses = await prompts(questions);
    
    // Update the data with responses
    this.updateDataFromResponses(responses);
  }

  private createQuestionsFromSchema() {
    const questions: any[] = [];
    const self = this;
    
    // Helper function to add questions for nested objects
    function addQuestions(prefix: string, schema: any, currentData: any) {
      const shape = schema.shape;
      
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const zodField = fieldSchema as any;
        const fieldName = prefix ? prefix + key.charAt(0).toUpperCase() + key.slice(1) : key;
        
        if (zodField._def.typeName === 'ZodObject') {
          // Nested object - recurse
          addQuestions(key, zodField, currentData[key] || {});
        } else {
          // Primitive field
          let type = 'text';
          if (zodField._def.typeName === 'ZodNumber') type = 'number';
          else if (zodField._def.typeName === 'ZodBoolean') type = 'confirm';
          
          const description = zodField._def.description || fieldName;
          
          const question: any = {
            type,
            name: fieldName,
            message: description,
            initial: self.getInitial(currentData[key])
          };
          
          // Add validation using Zod
          question.validate = (value: any) => {
            const result = zodField.safeParse(value);
            if (result.success) return true;
            return result.error.issues[0]?.message || 'Invalid value';
          };
          
          questions.push(question);
        }
      }
    }
    
    // Initialize with default values from config schema
    const defaultData = {
      telegram: { token: '@@TG_TOKEN', chatId: '@@TG_CHAT_ID', spamDelay: 300, initialDelay: 10, message: 'Changes detected' },
      camera: { name: 'OBS Virtual Camera', frameRate: 1 },
      diff: { pixels: 1000, threshold: 0.0 }
    };
    
    addQuestions('', configSchema, defaultData);
    return questions;
  }

  private getInitial<T>(value: T): T | undefined {
    return typeof value === 'string' && value.startsWith('@@') ? undefined : value;
  }

  private updateDataFromResponses(responses: any) {
    // Initialize data structure if not exists
    if (!this.data) {
      this.data = {
        telegram: { token: '', chatId: 0, spamDelay: 300, initialDelay: 10, message: '' },
        camera: { name: '', frameRate: 1 },
        diff: { pixels: 1000, threshold: 0.0 }
      };
    }

    for (const [key, value] of Object.entries(responses)) {
      if (key.startsWith('telegram')) {
        const telegramKey = key.replace('telegram', '').toLowerCase();
        if (telegramKey && telegramKey !== 'telegram') {
          (this.data.telegram as any)[telegramKey] = value;
        }
      } else if (key.startsWith('camera')) {
        const cameraKey = key.replace('camera', '').toLowerCase();
        if (cameraKey && cameraKey !== 'camera') {
          (this.data.camera as any)[cameraKey] = value;
        }
      } else if (key.startsWith('diff')) {
        const diffKey = key.replace('diff', '').toLowerCase();
        if (diffKey && diffKey !== 'diff') {
          (this.data.diff as any)[diffKey] = value;
        }
      }
    }
  }

  public getTGConfig(): TelegramConfig {
    return this.data.telegram;
  }

  public getDiffConfig(): DiffConfig {
    return this.data.diff;
  }

  public getCameraConfig(): CameraConfig {
    return this.data.camera;
  }
}
