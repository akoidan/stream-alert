#include <napi.h>
#include "./headers/capture.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize capture module
    return InitCapture(env, exports);
}

NODE_API_MODULE(native, Init)
