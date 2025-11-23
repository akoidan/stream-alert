import {Logger, Module} from '@nestjs/common';
import {CameraConfData, DiffConfData, IConfigResolver, TelegramConfigData} from "@/config/config-resolve-model";
import {FileConfigReader} from "@/config/file-config-reader.service";
import {isSea} from "node:sea";
import {PromptConfigReader} from "@/config/promt-config-reader.service";


@Module({
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    {
      provide: FileConfigReader,
      inject: [Logger],
      useFactory: async (logger: Logger): Promise<FileConfigReader> => {
        const data = new PromptConfigReader(logger, isSea() ? __dirname : process.cwd());
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
