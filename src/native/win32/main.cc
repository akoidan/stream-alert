#include <napi.h>
#include "../../shared/capture/headers/capture.h"
#include "./imageproc/headers/imageproc.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize capture module
    exports = Capture::Init(env, exports);
    // Initialize image processor module
    exports = ImageProc::Init(env, exports);
    return exports;
}

NODE_API_MODULE(native, Init)
