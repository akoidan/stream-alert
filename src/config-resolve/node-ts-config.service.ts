import {Injectable} from '@nestjs/common';
import {IConfigResolver} from "@/config-resolve/config-resolve-model";
import type {Camera, Diff, IConfig, Telegram} from "node-ts-config";

@Injectable()
export class NodeTsConfigService implements IConfigResolver {
  private config: IConfig = null!;

  public load() {
    this.config = require('node-ts-config').config;
  }

  public getTGConfig(): Telegram {
    return this.config.telegram;
  }

  public getDiffConfig(): Diff {
    return this.config.diff;
  }

  public getCameraConfig(): Camera {
    return this.config.camera;
  }
}
