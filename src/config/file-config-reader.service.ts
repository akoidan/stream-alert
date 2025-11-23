import {Injectable, Logger} from '@nestjs/common';
import {IConfigResolver} from "@/config/config-resolve-model";
import {promises as fs} from "fs";
import path from "path";
import {CameraConfig, Config, configSchema, DiffConfig, TelegramConfig} from "@/config/config-zod-schema";

@Injectable()
export class FileConfigReader implements IConfigResolver{
  protected data: Config = null!;
  constructor(
    protected readonly logger: Logger,
    protected readonly configsPath: string
  ) {
  }


  protected get confPath():string {
    return path.join(this.configsPath, 'stream-alert.json');
  };

  public async load() {
    const data = await fs.readFile(this.confPath, 'utf8');
    this.data = await configSchema.parseAsync(JSON.parse(data));
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
