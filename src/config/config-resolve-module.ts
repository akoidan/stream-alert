import {Logger, Module} from '@nestjs/common';
import {
  CameraConfData, ConfigPath,
  DiffConfData,
  IConfigResolver, Platform,
  TelegrafGet,
  TelegramConfigData
} from "@/config/config-resolve-model";
import {FileConfigReader} from "@/config/file-config-reader.service";
import {isSea} from "node:sea";
import {PromptConfigReader} from "@/config/promt-config-reader.service";
import {NativeModule} from "@/native/native-module";
import {INativeModule, Native} from "@/native/native-model";
import {FieldsValidator} from "@/config/fields-validator";
import {Telegraf} from "telegraf";


@Module({
  imports: [NativeModule],
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    FieldsValidator,
    {
      provide: TelegrafGet,
      useValue: (s: string) => new Telegraf(s)
    },
    {
      provide: Platform,
      useValue: process.platform
    },
    {
      provide: ConfigPath,
      useValue: isSea() ? __dirname : process.cwd()
    },
    {
      provide: FileConfigReader,
      inject: [Logger, ConfigPath, FieldsValidator],
      useFactory: async (logger: Logger, cp: string, validator: FieldsValidator): Promise<FileConfigReader> => {
        const data = new PromptConfigReader(logger, cp, validator);
        await data.load()
        return data;
      },
    },
    {
      provide: DiffConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getDiffConfig(),
      inject: [FileConfigReader],
    },
    {
      provide: CameraConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getCameraConfig(),
      inject: [FileConfigReader],
    },
    {
      provide: TelegramConfigData,
      useFactory: (resolver: IConfigResolver) => resolver.getTGConfig(),
      inject: [FileConfigReader],
    }
  ],
})
export class ConfigResolveModule {

}
