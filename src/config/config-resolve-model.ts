import type {CameraConfig, DiffConfig, TelegramConfig} from '@/config/config-zod-schema';


const CameraConfData = 'CameraConf';
const TelegramConfigData = 'TelegramConfig';
const DiffConfData = 'DiffConf';

interface IConfigResolver {
  load(): Promise<boolean>;

  getTGConfig(): TelegramConfig;

  getDiffConfig(): DiffConfig;

  getCameraConfig(): CameraConfig;
}

const TelegrafGet = 'TelegrafGet';
const Platform = 'Platform';
const ConfigPath = 'ConfigPath';

const ConfigData = 'ConfigData';


export {CameraConfData, TelegramConfigData, DiffConfData, TelegrafGet, Platform, ConfigPath, ConfigData}
export type {IConfigResolver}