import {Injectable, Logger} from '@nestjs/common';
import {aconfigSchema} from "@/config/config-zod-schema";
import {FileConfigReader} from "@/config/file-config-reader.service";
import prompts from 'prompts';
import {promises as fs} from "fs";

@Injectable()
export class PromptConfigReader extends FileConfigReader {

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

    this.addQuestions('', aconfigSchema, questions);

    const responses = await prompts(questions);
    
    // Update the data with responses using recursive mapping
    this.updateDataFromResponsesRecursive(responses);
    this.logger.log(`Saving data to file ${this.confPath}`)
    await fs.writeFile(this.confPath, JSON.stringify(this.data, null, 2));
  }

  private addQuestions(prefix: string, schema: any, questions: any[], path: string[] = []): void {
    const shape = schema.shape;
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const zodField = fieldSchema as any;
      const currentPath = [...path, key];
      const fieldName = currentPath.join('.'); // Use dot notation like "telegram.token"
      
      if (zodField._def.typeName === 'ZodObject' || zodField.shape !== undefined) {
        // Nested object - recurse with the nested schema
        this.addQuestions(prefix, zodField, questions, currentPath);
      } else {
        // Primitive field - create question
        const question = this.createQuestion(fieldName, zodField);
        questions.push(question);
      }
    }
  }

  private createQuestion(fieldName: string, zodField: any): any {
    const type = this.detectFieldType(zodField);
    const description = zodField._def.description || fieldName;
    const defaultValue = this.getDefaultValue(zodField);
    
    const question: any = {
      type,
      name: fieldName,
      message: description,
      initial: defaultValue
    };
    
    // Add validation using Zod
    question.validate = (value: any) => {
      const result = zodField.safeParse(value);
      if (result.success) return true;
      return result.error.issues[0]?.message || 'Invalid value';
    };
    
    return question;
  }

  private detectFieldType(zodField: any): string {
    let type = 'text';
    const innerType = this.unwrapZodField(zodField);
    
    if (innerType._def.type === 'number') {
      type = 'number';
    } else if (innerType._def.type === 'boolean') {
      type = 'confirm';
    }
    
    return type;
  }

  private unwrapZodField(zodField: any): any {
    let innerType = zodField;
    
    // Unwrap ZodDefault if present (type: "default")
    if (innerType._def.type === 'default') {
      innerType = innerType._def.innerType;
    }
    
    // Unwrap ZodEffects if present (from .int(), .min(), etc.)
    if (innerType._def.type === 'effect') {
      innerType = innerType._def.schema;
    }
    
    return innerType;
  }

  private getDefaultValue(zodField: any): any {
    if (zodField._def.type === 'default') {
      try {
        return zodField._def.defaultValue;
      } catch {
        return undefined;
      }
    }
    return undefined;
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
}
