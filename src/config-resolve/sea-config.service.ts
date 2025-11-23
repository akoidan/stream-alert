import {Injectable} from '@nestjs/common';
import {GlobalSeaConf, IConfigResolver} from "@/config-resolve/config-resolve-model";
import type {Camera, Diff, Telegram} from "node-ts-config";

@Injectable()
export class SeaConfigService implements IConfigResolver{
  constructor(private readonly globalSeaConf: GlobalSeaConf) {
  }


  public load() {
    if (!this.globalSeaConf.data.camera) {
      throw new Error("Sea has not been populated");
    }
  }

  public getTGConfig(): Telegram {
    return this.globalSeaConf.data.telegram;
  }

  public getDiffConfig(): Diff {
    return this.globalSeaConf.data.diff;
  }

  public getCameraConfig(): Camera {
    return this.globalSeaConf.data.camera;
  }
}
