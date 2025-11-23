import {Logger, Module} from '@nestjs/common';
import {CameraConfData, DiffConfData, IConfigResolver, TelegramConfigData} from "@/config/config-resolve-model";
import {SimpleConfigService} from "@/config/simple-config.service";
import {isSea} from "node:sea";


@Module({
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    {
      provide: SimpleConfigService,
      inject: [Logger],
      useFactory: async (logger: Logger): Promise<SimpleConfigService> => {
        const data = new SimpleConfigService(logger, isSea() ? __dirname : process.cwd());
        await data.load()
        return data;
      },
    },
    {
      provide: DiffConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getDiffConfig(),
      inject: [SimpleConfigService],
    },
    {
      provide: CameraConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getCameraConfig(),
      inject: [SimpleConfigService],
    },
    {
      provide: TelegramConfigData,
      useFactory: (resolver: IConfigResolver) => resolver.getTGConfig(),
      inject: [SimpleConfigService],
    }
  ],
})
export class ConfigResolveModule {

}
