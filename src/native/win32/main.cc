#include <napi.h>
#include "./capture/headers/capture.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize capture module
    return Capture::Init(env, exports);
}

NODE_API_MODULE(native, Init)
