import {Injectable, Logger} from '@nestjs/common';
import {promises as fs} from "fs";
import path from "path";
import {CameraConfig, configSchema, DiffConfig, TelegramConfig} from "@/config/config-zod-schema";
import {SimpleConfigService} from "@/config/simple-config.service";

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
