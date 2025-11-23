import {Logger, Module, OnModuleInit} from '@nestjs/common';
import {ConfigPath} from "@/config/config-resolve-model";
import {isSea} from "node:sea";
import {SeaConfigService} from "@/config/sea-config.service";


@Module({
  exports: [SeaConfigService],
  providers: [
    Logger,
    SeaConfigService,
    {
      provide: ConfigPath,
      inject: [],
      useFactory: (): string => {
        return isSea() ? __dirname : process.cwd();
      },
    },
  ],
})
export class ConfigLoadModule implements OnModuleInit {

  constructor(
    private readonly logger: Logger,
    private readonly configResolver: SeaConfigService) {
  }

  async onModuleInit() {
    this.logger.log("Reading config");
    await this.configResolver.load();
    this.logger.log("Read config");
  }

}
