#include "imageproc.h"
#include "toojpeg.h"
#include "toojpeg.cpp"
#include <algorithm>
#include <cmath>

// Global context for JPEG writing
static std::vector<unsigned char>* g_jpegContext = nullptr;

// C-style callback for TooJPEG
static void jpegWriteCallback(unsigned char byte) {
    if (g_jpegContext) {
        g_jpegContext->push_back(byte);
    }
}

// JPEG encoder using TooJPEG
std::vector<unsigned char> EncodeJPEG(const SimpleImage& img) {
    std::vector<unsigned char> jpegData;
    
    // Set global context for callback
    g_jpegContext = &jpegData;
    
    // Use TooJPEG to encode
    bool success = TooJpeg::writeJpeg(jpegWriteCallback, 
                            img.data.data(), 
                            static_cast<unsigned short>(img.width), 
                            static_cast<unsigned short>(img.height), 
                            true,  // isRGB
                            85,    // quality
                            false, // downsample
                            nullptr); // comment
    
    // Clear global context
    g_jpegContext = nullptr;
    
    if (!success) {
        throw std::runtime_error("JPEG encoding failed");
    }
    
    return jpegData;
}

// Compare two RGB images and return number of different pixels (ULTRA FAST - no decoding)
size_t CompareRgbImagesDirect(const unsigned char* data1, const unsigned char* data2, int width, int height, double threshold) {
    // Pre-calculate threshold as integer for faster comparison
    const int thresholdInt = static_cast<int>(threshold * 255.0);
    
    size_t diffPixels = 0;
    const size_t totalPixels = width * height;
    
    // Optimized loop with integer math and direct pointer access
    for (size_t i = 0; i < totalPixels; ++i) {
        const size_t pixelOffset = i * 3;
        
        // Calculate RGB differences using integer math (much faster than double)
        const int rDiff = std::abs(static_cast<int>(data1[pixelOffset]) - static_cast<int>(data2[pixelOffset]));
        const int gDiff = std::abs(static_cast<int>(data1[pixelOffset + 1]) - static_cast<int>(data2[pixelOffset + 1]));
        const int bDiff = std::abs(static_cast<int>(data1[pixelOffset + 2]) - static_cast<int>(data2[pixelOffset + 2]));
        
        // Fast average using integer arithmetic
        const int avgDiff = (rDiff + gDiff + bDiff) / 3;
        
        if (avgDiff > thresholdInt) {
            diffPixels++;
        }
    }
    
    return diffPixels;
}

namespace ImageProc {
    Napi::Value ConvertRgbToJpeg(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 3) {
            throw Napi::TypeError::New(env, "Wrong number of arguments");
        }
        
        if (!info[0].IsBuffer() || !info[1].IsNumber() || !info[2].IsNumber()) {
            throw Napi::TypeError::New(env, "Arguments must be: buffer, width, height");
        }
        
        Napi::Buffer<unsigned char> buffer = info[0].As<Napi::Buffer<unsigned char>>();
        int width = info[1].As<Napi::Number>().Int32Value();
        int height = info[2].As<Napi::Number>().Int32Value();
        
        // Validate dimensions
        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw Napi::RangeError::New(env, "Invalid image dimensions");
        }
        
        // Safety check: buffer size must match expected RGB data size
        const size_t expectedSize = width * height * 3;
        if (buffer.Length() < expectedSize) {
            throw Napi::Error::New(env, "Buffer too small for specified dimensions");
        }
        
        // Create SimpleImage from RGB data
        SimpleImage img;
        img.width = width;
        img.height = height;
        img.components = 3;
        img.data.assign(buffer.Data(), buffer.Data() + expectedSize);
        
        // Encode JPEG
        auto jpegData = EncodeJPEG(img);
        if (jpegData.empty()) {
            throw Napi::Error::New(env, "Failed to encode JPEG image");
        }
        
        return Napi::Buffer<unsigned char>::Copy(env, jpegData.data(), jpegData.size());
    }
    
    Napi::Value CompareRgbImages(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 5) {
            throw Napi::TypeError::New(env, "Wrong number of arguments");
        }
        
        if (!info[0].IsBuffer() || !info[1].IsBuffer() || !info[2].IsNumber() || !info[3].IsNumber() || !info[4].IsNumber()) {
            throw Napi::TypeError::New(env, "Arguments must be: buffer1, buffer2, width, height, threshold");
        }
        
        Napi::Buffer<unsigned char> buffer1 = info[0].As<Napi::Buffer<unsigned char>>();
        Napi::Buffer<unsigned char> buffer2 = info[1].As<Napi::Buffer<unsigned char>>();
        int width = info[2].As<Napi::Number>().Int32Value();
        int height = info[3].As<Napi::Number>().Int32Value();
        double threshold = info[4].As<Napi::Number>().DoubleValue();
        
        // Validate parameters
        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw Napi::RangeError::New(env, "Invalid image dimensions");
        }
        
        if (threshold < 0.0 || threshold > 1.0) {
            throw Napi::RangeError::New(env, "Threshold must be between 0 and 1");
        }
        
        // Safety check: buffer sizes must match expected RGB data size
        const size_t expectedSize = width * height * 3;
        if (buffer1.Length() < expectedSize || buffer2.Length() < expectedSize) {
            throw Napi::Error::New(env, "Buffer too small for specified dimensions");
        }
        
        // Compare RGB images directly (no decoding needed!)
        size_t diffPixels = CompareRgbImagesDirect(buffer1.Data(), buffer2.Data(), width, height, threshold);
        
        return Napi::Number::New(env, static_cast<double>(diffPixels));
    }
    
    Napi::Object Init(Napi::Env env, Napi::Object exports) {
        // RGB functions only - high performance processing
        exports.Set(Napi::String::New(env, "convertRgbToJpeg"), Napi::Function::New(env, ImageProc::ConvertRgbToJpeg));
        exports.Set(Napi::String::New(env, "compareRgbImages"), Napi::Function::New(env, ImageProc::CompareRgbImages));
        
        return exports;
    }
}
