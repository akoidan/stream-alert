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
    
    // Update the data with responses using recursive mapping
    this.updateDataFromResponsesRecursive(responses);
  }

  private createQuestionsFromSchema() {
    const questions: any[] = [];
    const self = this;

    
    // Helper function to recursively add questions
    function addQuestions(prefix: string, schema: any, currentData: any, path: string[] = []) {
      const shape = schema.shape;
      
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const zodField = fieldSchema as any;
        const currentPath = [...path, key];
        const fieldName = currentPath.join('.'); // Use dot notation like "telegram.token"
        
        if (zodField._def.typeName === 'ZodObject') {
          // Nested object - recurse
          addQuestions(prefix, zodField, currentData[key] || {}, currentPath);
        } else {
          // Primitive field
          let type = 'text';
          if (zodField._def.typeName === 'ZodNumber') type = 'number';
          else if (zodField._def.typeName === 'ZodBoolean') type = 'confirm';
          
          const description = zodField._def.description || fieldName;
          
          const question: any = {
            type,
            name: fieldName, // Use dot notation for field names
            message: description,
            initial: self.getInitial(self.getNestedValue(currentData, currentPath))
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
    
    addQuestions('', configSchema, defaultData);
    return questions;
  }

  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    const lastKey = path.pop()!;
    const target = path.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private getInitial<T>(value: T): T | undefined {
    return typeof value === 'string' && value.startsWith('@@') ? undefined : value;
  }

  private updateDataFromResponsesRecursive(responses: any) {
    // Initialize data with defaults from Zod schema
    this.data = configSchema.parse({});
    
    // Update with user responses
    for (const [fieldName, value] of Object.entries(responses)) {
      const path = fieldName.split('.'); // Split "telegram.token" -> ["telegram", "token"]
      this.setNestedValue(this.data, path, value);
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
