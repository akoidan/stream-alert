#pragma once

#include <napi.h>
#include <vector>
#include <memory>

struct SimpleImage {
    int width;
    int height;
    int components;
    std::vector<unsigned char> data;
};

namespace ImageProc {
    // High-Performance RGB Functions
    Napi::Value ConvertRgbToJpeg(const Napi::CallbackInfo& info);
    Napi::Value CompareRgbImages(const Napi::CallbackInfo& info);
    
    // Initialize image processor module
    Napi::Object Init(Napi::Env env, Napi::Object exports);
}
