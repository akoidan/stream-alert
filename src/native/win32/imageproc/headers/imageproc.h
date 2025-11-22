#pragma once

#include <napi.h>
#include <vector>
#include <memory>

class ImageProcessor {
public:
    ImageProcessor();
    ~ImageProcessor();
    
    // Process frame and return JPEG buffer if changed, null if not
    Napi::Value ProcessFrame(const Napi::CallbackInfo& info);
    
    // Get last processed frame as JPEG buffer
    Napi::Value GetLastFrame(const Napi::CallbackInfo& info);

private:
    struct SimpleImage {
        int width;
        int height;
        int components;
        std::vector<unsigned char> data;
    };
    
    std::unique_ptr<SimpleImage> lastFrame_;
    double threshold_;
    double diffThreshold_;
    
    // Decode BMP from buffer (simplified - assumes 24-bit BMP)
    std::unique_ptr<SimpleImage> DecodeBMP(const unsigned char* buffer, size_t length);
    
    // Encode image to JPEG buffer using TooJPEG
    std::vector<unsigned char> EncodeJPEG(const SimpleImage& img);
    
    // Compare two images and return number of different pixels
    size_t CompareImages(const SimpleImage& img1, const SimpleImage& img2);
};

namespace ImageProc {
    // Initialize image processor module
    Napi::Object Init(Napi::Env env, Napi::Object exports);
    
    // Create processor instance
    Napi::Value CreateProcessor(const Napi::CallbackInfo& info);
    
    // Process frame
    Napi::Value ProcessFrame(const Napi::CallbackInfo& info);
    
    // Get last frame
    Napi::Value GetLastFrame(const Napi::CallbackInfo& info);
}
