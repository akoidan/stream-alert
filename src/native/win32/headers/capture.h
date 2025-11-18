#pragma once

#include <napi.h>
#include <windows.h>
#include <vfw.h>

namespace Capture {
    Napi::Object Init(Napi::Env env, Napi::Object exports);
    
    class CaptureDevice {
    public:
        static Napi::Value Initialize(const Napi::CallbackInfo& info);
        static Napi::Value Start(const Napi::CallbackInfo& info);
        static Napi::Value Stop(const Napi::CallbackInfo& info);
        static Napi::Value GetFrame(const Napi::CallbackInfo& info);
    };
}
