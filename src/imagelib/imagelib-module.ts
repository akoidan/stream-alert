/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {ImagelibService} from "@/imagelib/imagelib-service";
import {NativeModule} from "@/native/native-module";
import {ConfigResolveModule} from "@/config-resolve/config-resolve-module";

@Module({
  imports: [NativeModule, ConfigResolveModule],
  providers: [
    Logger,
    ImagelibService,
  ],
  exports: [ImagelibService]
})
export class ImagelibModule {

}
