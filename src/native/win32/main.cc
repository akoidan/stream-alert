#include <napi.h>
#include "./headers/capture.h"
#include <iostream>

static bool g_comInitialized = false;

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize COM like FFmpeg does - CoInitialize(0)
    if (!g_comInitialized) {
        HRESULT hr = CoInitialize(0);
        if (hr == S_OK || hr == S_FALSE) {
            g_comInitialized = true;
            std::cout << "[capture] COM initialized with CoInitialize(0) like FFmpeg." << std::endl;
        } else {
            std::cout << "[capture] Failed to initialize COM (hr=" << std::hex << hr << std::dec << ")" << std::endl;
        }
    }
    
    // Initialize capture module
    return InitCapture(env, exports);
}

// Cleanup function called when module is unloaded
void Cleanup(Napi::Env env) {
    if (g_comInitialized) {
        CoUninitialize();
        g_comInitialized = false;
        std::cout << "[capture] COM uninitialized at module cleanup." << std::endl;
    }
}

NODE_API_MODULE(native, Init)
