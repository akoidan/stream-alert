import type {Camera, Diff, IConfig, Telegram} from "node-ts-config";

export const CameraConf = 'CameraConf';
export const TelegramConfig = 'TelegramConfig';
export const DiffConf = 'DiffConf'
export const ConfigResolver = 'ConfigResolver'

export interface IConfigResolver {
  load(): void;
  getTGConfig(): Telegram;
  getDiffConfig(): Diff;
  getCameraConfig(): Camera;
}
export interface GlobalSeaConf {
  data: IConfig;
}

export const globalSeaConf: GlobalSeaConf = {data: {}} as any;