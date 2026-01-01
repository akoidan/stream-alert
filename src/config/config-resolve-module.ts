import {Logger, Module} from '@nestjs/common';
import {
  CameraConfData,
  ConfigData,
  ConfigPath,
  DiffConfData,
  Platform,
  TelegrafGet,
  TelegramConfigData,
} from '@/config/config-resolve-model';
import {isSea} from 'node:sea';
import {PromptConfigReader} from '@/config/promt-config-reader.service';
import {NativeModule} from '@/native/native-module';
import {Telegraf} from 'telegraf';
import {FileConfigReader} from '@/config/file-config-reader.service';
import {CameraConfig, Config, DiffConfig, TelegramConfig} from '@/config/config-zod-schema';
import process from 'node:process';
import path from 'path';
import yargs from 'yargs';


@Module({
  imports: [NativeModule],
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    FileConfigReader,
    PromptConfigReader,
    {
      provide: TelegrafGet,
      useValue: (s: string): Telegraf => new Telegraf(s),
    },
    {
      provide: Platform,
      useValue: process.platform,
    },
    {
      provide: ConfigPath,
      useFactory: async(): Promise<string> => {
        const res = isSea() ? __dirname : process.cwd();
        const {config} = await yargs(process.argv.slice(2))
          .strict()
          .scriptName('stream-alert')
          .epilog('Refer https://github.com/akoidan/stream-alert for more documentation')
          .usage('Get a Telegram notification when your webcam or screen changes\n')
          .option('config', {
            type: 'string',
            default: path.join(res, 'stream-alert.jsonc'),
            description: 'Nain config file',
          })
          .parse();
        return config;
      },
    },
    {
      provide: ConfigData,
      inject: [PromptConfigReader, FileConfigReader],
      useFactory: async(cr: PromptConfigReader, fr: FileConfigReader): Promise<Config> => {
        if (await fr.canHandle()) {
          await fr.load();
        } else {
          const data = await cr.load();
          await fr.save(data);
        }
        return fr.data;
      },
    },
    {
      provide: DiffConfData,
      useFactory: (resolver: Config): DiffConfig => resolver.diff,
      inject: [ConfigData],
    },
    {
      provide: CameraConfData,
      useFactory: (resolver: Config): CameraConfig => resolver.camera,
      inject: [ConfigData],
    },
    {
      provide: TelegramConfigData,
      useFactory: (resolver: Config): TelegramConfig => resolver.telegram,
      inject: [ConfigData],
    },
  ],
})
export class ConfigResolveModule {

}
