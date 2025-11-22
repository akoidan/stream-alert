import {Injectable} from '@nestjs/common';
import {globalSeaConf, IConfigResolver} from "@/config-resolve/config-resolve-model";
import {Camera, Diff, IConfig, Telegram} from "node-ts-config";

@Injectable()
export class SeaConfigService implements IConfigResolver{
  private config: IConfig = null!;

  public load() {
    if (!globalSeaConf.camera) {
      throw new Error("Sea has not been populated");
    }
  }

  public getTGConfig(): Telegram {
    return globalSeaConf.telegram;
  }

  public getDiffConfig(): Diff {
    return globalSeaConf.diff;
  }

  public getCameraConfig(): Camera {
    return globalSeaConf.camera;
  }
}
