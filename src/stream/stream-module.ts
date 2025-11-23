import {Logger, Module} from '@nestjs/common';
import {StreamService} from "@/stream/stream-service";
import {NativeModule} from "@/native/native-module";
import {ConfigResolveModule} from "@/config/config-resolve-module";

@Module({
  imports: [NativeModule, ConfigResolveModule],
  exports: [StreamService],
  providers: [
    Logger,
    StreamService,
  ],
})
export class StreamModule {

}
