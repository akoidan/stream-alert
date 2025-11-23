#include <napi.h>

#include "imageproc.h"
#include "capture.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports = Capture::Init(env, exports);
    return ImageProc::Init(env, exports);
}

NODE_API_MODULE(native, Init)
