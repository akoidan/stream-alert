#pragma once

#include <napi.h>
#include <vector>
#include <cstdint>

// Common frame data structure
struct FrameData {
    std::vector<uint8_t> buffer;
    int width;
    int height;
    size_t dataSize;
};

// Common image processing functions
namespace CommonImageProc {
    // Convert RGB buffer to JPEG
    Napi::Value ConvertRgbToJpeg(const Napi::CallbackInfo& info);
    
    // Compare two RGB images
    Napi::Value CompareRgbImages(const Napi::CallbackInfo& info);
    
    // Initialize common image processing module
    Napi::Object Init(Napi::Env env, Napi::Object exports);
}
