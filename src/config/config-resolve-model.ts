import {CameraConfig, DiffConfig, TelegramConfig} from "@/config/config-zod-schema";


export const CameraConfData = 'CameraConf';
export const TelegramConfigData = 'TelegramConfig';
export const DiffConfData = 'DiffConf'

export interface IConfigResolver {
  load(): Promise<boolean>;
  getTGConfig(): TelegramConfig;
  getDiffConfig(): DiffConfig;
  getCameraConfig(): CameraConfig;
}

export const TelegrafGet = 'TelegrafGet';
export const Platform = 'Platform';
export const ConfigPath = 'ConfigPath';

export const ConfigData = 'ConfigData';
