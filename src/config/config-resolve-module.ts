import {Logger, Module} from '@nestjs/common';
import {
  CameraConfData,
  ConfigPath,
  DiffConfData,
  IConfigResolver,
  Platform,
  PromptSetup,
  TelegrafGet,
  TelegramConfigData
} from "@/config/config-resolve-model";
import {isSea} from "node:sea";
import {PromptConfigReader} from "@/config/promt-config-reader.service";
import {NativeModule} from "@/native/native-module";
import {Telegraf} from "telegraf";


@Module({
  imports: [NativeModule],
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    PromptConfigReader,
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
      provide: PromptSetup,
      inject: [PromptConfigReader],
      useFactory: async(cr: PromptConfigReader) => {
        await cr.load()
        return cr;
      }
    },
    {
      provide: DiffConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getDiffConfig(),
      inject: [PromptSetup],
    },
    {
      provide: CameraConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getCameraConfig(),
      inject: [PromptSetup],
    },
    {
      provide: TelegramConfigData,
      useFactory: (resolver: IConfigResolver) => resolver.getTGConfig(),
      inject: [PromptSetup],
    }
  ],
})
export class ConfigResolveModule {

}
