import {Inject, Injectable, Logger} from '@nestjs/common';
import {aconfigSchema, Config} from '@/config/config-zod-schema';
import prompts, {Choice, PromptObject, PromptType} from 'prompts';

import {ZodObject, type ZodTypeAny} from 'zod';
import {INativeModule, Native} from '@/native/native-model';
import {Telegraf} from 'telegraf';
import {Platform, TelegrafGet} from '@/config/config-resolve-model';

type PromptResponse = Record<string, string | number | boolean>;

@Injectable()
export class PromptConfigReader {
  private tGToken: string | null = null;

  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly native: INativeModule,
    @Inject(Platform)
    private readonly platform: NodeJS.Platform,
    @Inject(TelegrafGet)
    private readonly getTG: (s: string) => Telegraf,
  ) {
  }

  public async validateTgChat(value: any) {
    if (!this.tGToken) {
      throw new Error('Unexpected validation error');
    }
    const bot = this.getTG(this.tGToken!);
    const tokenValid = await bot.telegram.getChat(value).then(() => true).catch(() => false);
    if (!tokenValid) {
      return 'ChatID not found';
    }
    return true;
  }

  public async validateTgToken(value: any) {
    const bot = this.getTG(value);
    const tokenValid = await bot.telegram.getMe().then(() => true).catch(() => false);
    if (!tokenValid) {
      return 'Invalid token';
    }
    this.tGToken = value;
    return true;
  }

  public async load(): Promise<Config> {
    this.logger.log('\n🤖 First, create a Telegram bot:\n'
      + '  1. Open @BotFather in Telegram\n'
      + '  2. Send /newbot and follow the instructions\n'
      + '  3. Save the bot token for the next step\n');

    const questions: PromptObject[] = [];

    this.addQuestions('', aconfigSchema, questions, []);

    const responses = await prompts(questions);

    // Update the data with responses using recursive mapping
    return this.updateDataFromResponsesRecursive(responses);
  }

  private addQuestions(prefix: string, schema: ZodObject, questions: PromptObject[], path: string[]): void {
    for (const [key, fieldSchema] of Object.entries(schema.shape)) {
      const zodField = fieldSchema as ZodObject;
      const currentPath = [...path, key];
      const fieldName = currentPath.join('.'); // Use dot notation like "telegram.token"

      if ((zodField._def as any).typeName || zodField.shape !== undefined) {
        // Nested object - recurse with the nested schema
        this.addQuestions(prefix, zodField, questions, currentPath);
      } else {
        // Primitive field - create question
        const question = this.createQuestion(fieldName, zodField);
        questions.push(question);
      }
    }
  }

  private createQuestion(fieldName: string, zodField: ZodTypeAny): PromptObject {
    const descrp = this.unwrapZodField(zodField).description;
    if (!descrp) {
      throw Error(`${fieldName} doesnt have description`);
    }
    if (fieldName === 'camera.name') {
      const cameras = this.native.listAvailableCameras();
      if (cameras.length === 0) {
        throw Error('Cannot find any cameras in the system');
      }
      const choices: Choice[] = cameras.map(c => ({
        title: c.name,
        value: this.platform === 'linux' ? c.path : c.name,
      }));
      return {
        type: 'select',
        name: fieldName,
        message: descrp,
        choices,
      };
    }
    return {
      type: this.detectFieldType(zodField) as PromptType,
      name: fieldName,
      message: descrp,
      initial: (zodField as any).def.defaultValue,
      validate: async(value: string | number | boolean) => {
        const result = zodField.safeParse(value);
        if (result.success) {
          if (fieldName === 'telegram.chatId') {
            return this.validateTgChat(value);
          } else if (fieldName === 'telegram.token') {
            return this.validateTgToken(value);
          }
          return true;
        }
        return result.error?.issues[0]?.message || 'Invalid value';
      },
    };
  }

  // Add validation using Zod


  private detectFieldType(zodField: ZodTypeAny): string {
    let type = 'text';
    const innerType = this.unwrapZodField(zodField);

    if (innerType._def.type === 'number') {
      type = 'number';
    } else if (innerType._def.type === 'boolean') {
      type = 'confirm';
    }

    return type;
  }

  private unwrapZodField(zodField: ZodTypeAny): ZodTypeAny {
    let innerType = zodField;
    const def = innerType._def as any;

    // Unwrap ZodDefault if present (type: "default")
    if (def.type === 'default') {
      innerType = def.innerType;
    }

    // Unwrap ZodEffects if present (from .int(), .min(), etc.)
    const innerDef = innerType._def as any;
    if (innerDef.typeName === 'ZodEffects') {
      innerType = innerDef.innerType;
    }

    return innerType;
  }

  private setNestedValue(obj: Record<string, any>, path: string[], value: string | number | boolean): void {
    const lastKey = path.pop()!;
    const target = path.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }


  private updateDataFromResponsesRecursive(responses: PromptResponse): Config {
    // Start with empty object
    const data: Config = {} as Config;

    // Update with user responses
    for (const [fieldName, value] of Object.entries(responses)) {
      const path = fieldName.split('.'); // Split "telegram.token" -> ["telegram", "token"]
      this.setNestedValue(data, path, value);
    }
    return data;
  }
}
