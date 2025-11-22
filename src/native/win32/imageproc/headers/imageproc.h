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
    // Convert BMP buffer to JPEG buffer
    Napi::Value ConvertBmpToJpeg(const Napi::CallbackInfo& info);
    
    // Compare two BMP images and return number of different pixels
    Napi::Value CompareBmpImages(const Napi::CallbackInfo& info);
    
    // Initialize image processor module
    Napi::Object Init(Napi::Env env, Napi::Object exports);
}
