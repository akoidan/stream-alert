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


@Module({
  imports: [NativeModule],
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    FileConfigReader,
    PromptConfigReader,
    {
      provide: TelegrafGet,
      useValue: (s: string) => new Telegraf(s),
    },
    {
      provide: Platform,
      useValue: process.platform,
    },
    {
      provide: ConfigPath,
      useValue: isSea() ? __dirname : process.cwd(),
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
