#pragma once

#include <napi.h>

Napi::Object InitCapture(Napi::Env env, Napi::Object exports);

namespace Capture {
    class CaptureDevice {
    public:
        static Napi::Value Initialize(const Napi::CallbackInfo& info);
        static Napi::Value Start(const Napi::CallbackInfo& info);
        static Napi::Value Stop(const Napi::CallbackInfo& info);
        static Napi::Value GetFrame(const Napi::CallbackInfo& info);
    };
}
