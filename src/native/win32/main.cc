#include <napi.h>
#include "capture.h"
#include "imageproc.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize capture module
    exports = Capture::Init(env, exports);
    // Initialize image processor module
    exports = ImageProc::Init(env, exports);
    return exports;
}

NODE_API_MODULE(native, Init)
