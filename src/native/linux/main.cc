#include <napi.h>
#include "capture/capture.h"
#include "../shared/imageproc/imageproc.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Set up capture module exports
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Capture::Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Capture::Stop));
    exports.Set(Napi::String::New(env, "getFrame"), Napi::Function::New(env, Capture::GetFrame));

    // Image processing utilities
    exports = ImageProc::Init(env, exports);

    return exports;
}

NODE_API_MODULE(native, Init)
