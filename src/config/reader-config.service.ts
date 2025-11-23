import {Injectable, Logger} from '@nestjs/common';
import {CameraConfig, configSchema, DiffConfig, TelegramConfig} from "@/config/config-zod-schema";
import {SimpleConfigService} from "@/config/simple-config.service";
import prompts from 'prompts';
import {promises as fs} from "fs";

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
      this.logger.warn(`Can't parse config file at ${this.confPath}`);
      
      // Initialize with default values and prompt user for configuration
      await this.promptForConfiguration();
    }
  }

  private async promptForConfiguration() {
    this.logger.log('\n🤖 First, create a Telegram bot:\n'
      + '  1. Open @BotFather in Telegram\n'
      + '  2. Send /newbot and follow the instructions\n'
      + '  3. Save the bot token for the next step\n');

    const questions: any[] = [];

    this.addQuestions('', configSchema, questions);

    const responses = await prompts(questions);
    
    // Update the data with responses using recursive mapping
    this.updateDataFromResponsesRecursive(responses);
    this.logger.log(`Saving data to file ${this.confPath}`)
    await fs.writeFile(this.confPath, JSON.stringify(this.data));
  }

  private addQuestions(prefix: string, schema: any, questions: any[], path: string[] = []): void {
    const shape = schema.shape;
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const zodField = fieldSchema as any;
      const currentPath = [...path, key];
      const fieldName = currentPath.join('.'); // Use dot notation like "telegram.token"
      
      // Check if it's a Zod object by checking if it has a 'shape' property
      const isZodObject = zodField._def.typeName === 'ZodObject' || zodField.shape !== undefined;
      
      if (isZodObject) {
        // Nested object - recurse with the nested schema
        this.addQuestions(prefix, zodField, questions, currentPath);
      } else {
        // Primitive field
        let type = 'text';
        
        // Check the actual type by looking at the inner structure
        let innerType = zodField;
        
        // Unwrap ZodDefault if present (type: "default")
        if (innerType._def.type === 'default') {
          innerType = innerType._def.innerType;
        }
        
        // Unwrap ZodEffects if present (from .int(), .min(), etc.)
        if (innerType._def.type === 'effect') {
          innerType = innerType._def.schema;
        }
        
        // Now check the actual underlying type using .type property
        if (innerType._def.type === 'number') {
          type = 'number';
        } else if (innerType._def.type === 'boolean') {
          type = 'confirm';
        }
        
        const description = zodField._def.description || fieldName;
        
        // Get default value from Zod schema - handle ZodDefault properly
        let defaultValue;
        if (zodField._def.type === 'default') {
          try {
            defaultValue = zodField._def.defaultValue;
          } catch {
            defaultValue = undefined;
          }
        } else {
          defaultValue = undefined;
        }
        
        const question: any = {
          type,
          name: fieldName, // Use dot notation for field names
          message: description,
          initial: defaultValue
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

  private setNestedValue(obj: any, path: string[], value: any): void {
    const lastKey = path.pop()!;
    const target = path.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }


  private updateDataFromResponsesRecursive(responses: any) {
    // Start with empty object
    this.data = {} as any;
    
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
