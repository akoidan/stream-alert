import {Inject, Injectable} from '@nestjs/common';
import {INativeModule, Native, NativeCameraInfo} from "@/native/native-model";
import {Telegraf} from "telegraf";
import {Platform, TelegrafGet} from "@/config/config-resolve-model";

@Injectable()
export class FieldsValidator {

  private tGToken: string | null = null;
  private cameras: NativeCameraInfo[] | null = null;

  constructor(
    @Inject(Native)
    private readonly native: INativeModule,
    @Inject(Platform)
    private readonly platform: NodeJS.Platform,
    @Inject(TelegrafGet)
    private readonly getTG: (s: string) => Telegraf,
  ) {
  }

  public validateCamera(value: any) {
    if (!this.cameras) {
      this.cameras = this.native.listAvailableCameras();
    }
    if (this.platform === 'win32') {
      if (this.cameras.find(c => c.name === value)) {
        return true;
      }
      const cmrStr = this.cameras.map(c => c.name).join('\n');
      return `Invalid camera name, available devices: \n ${cmrStr}`;
    } else if (this.platform === 'linux') {
      if (this.cameras.find(c => c.path === value)) {
        return true;
      }
      const cmrStr = this.cameras.map(c => `${c.path} => ${c.name}`).join('\n');
      return `Invalid camera name, available devices: \n ${cmrStr}`;
    }
    return true;
  }

  public async validateTgChat(value: any) {
    if (!this.tGToken) {
      throw new Error('Unexpected validation error');
    }
    const bot = this.getTG(this.tGToken!)
    const tokenValid = await bot.telegram.getChat(value).then(() => true).catch(() => false);
    if (!tokenValid) {
      return 'ChatID not found';
    }
    return true;
  }

  public async validateTgToken(value: any) {
    const bot = this.getTG(value)
    const tokenValid = await bot.telegram.getMe().then(() => true).catch(() => false);
    if (!tokenValid) {
      return 'Invalid token';
    }
    this.tGToken = value;
    return true;
  }
}
