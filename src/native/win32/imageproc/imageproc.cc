#include "imageproc.h"
#include "toojpeg.h"
#include "toojpeg.cpp"
#include <algorithm>
#include <cmath>

static ImageProcessor* g_processor = nullptr;

// Global context for JPEG writing
static std::vector<unsigned char>* g_jpegContext = nullptr;

// C-style callback for TooJPEG
static void jpegWriteCallback(unsigned char byte) {
    if (g_jpegContext) {
        g_jpegContext->push_back(byte);
    }
}

ImageProcessor::ImageProcessor() : threshold_(0.1), diffThreshold_(1000) {
}

ImageProcessor::~ImageProcessor() {
}

// Simple BMP decoder for 24-bit BMPs (standard bottom-up format)
std::unique_ptr<ImageProcessor::SimpleImage> ImageProcessor::DecodeBMP(const unsigned char* buffer, size_t length) {
    if (length < 54) return nullptr; // BMP header is 54 bytes
    
    // Check BMP signature
    if (buffer[0] != 'B' || buffer[1] != 'M') return nullptr;
    
    auto img = std::make_unique<SimpleImage>();
    
    // Extract dimensions from BMP header
    img->width = *reinterpret_cast<const int*>(&buffer[18]);
    img->height = *reinterpret_cast<const int*>(&buffer[22]);
    img->components = 3; // RGB
    img->data.resize(img->width * img->height * 3);
    
    // BMP data starts at offset 54
    size_t dataOffset = *reinterpret_cast<const int*>(&buffer[10]);
    
    // BMP rows are padded to 4-byte boundaries
    int rowSize = ((img->width * 3 + 3) / 4) * 4;
    
    // Copy pixel data (BMP is stored bottom-to-top, BGR format)
    for (int y = 0; y < img->height; y++) {
        int srcY = img->height - 1 - y; // Flip vertically for bottom-up BMP
        size_t srcOffset = dataOffset + srcY * rowSize;
        size_t dstOffset = y * img->width * 3;
        
        for (int x = 0; x < img->width; x++) {
            size_t pixelSrc = srcOffset + x * 3;
            size_t pixelDst = dstOffset + x * 3;
            
            // Convert BGR to RGB
            img->data[pixelDst + 0] = buffer[pixelSrc + 2]; // R
            img->data[pixelDst + 1] = buffer[pixelSrc + 1]; // G
            img->data[pixelDst + 2] = buffer[pixelSrc + 0]; // B
        }
    }
    
    return img;
}

// JPEG encoder using TooJPEG
std::vector<unsigned char> ImageProcessor::EncodeJPEG(const SimpleImage& img) {
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
        return std::vector<unsigned char>();
    }
    
    return jpegData;
}

size_t ImageProcessor::CompareImages(const SimpleImage& img1, const SimpleImage& img2) {
    if (img1.width != img2.width || img1.height != img2.height || img1.components != img2.components) {
        return img1.width * img1.height;
    }
    
    size_t diffPixels = 0;
    size_t totalPixels = img1.width * img1.height;
    
    for (size_t i = 0; i < totalPixels; ++i) {
        size_t pixelOffset = i * img1.components;
        
        // Calculate RGB difference
        double rDiff = std::abs(static_cast<double>(img1.data[pixelOffset]) - img2.data[pixelOffset]);
        double gDiff = std::abs(static_cast<double>(img1.data[pixelOffset + 1]) - img2.data[pixelOffset + 1]);
        double bDiff = std::abs(static_cast<double>(img1.data[pixelOffset + 2]) - img2.data[pixelOffset + 2]);
        
        // Average difference and check threshold
        double avgDiff = (rDiff + gDiff + bDiff) / 3.0;
        if (avgDiff > threshold_ * 255.0) {
            diffPixels++;
        }
    }
    
    return diffPixels;
}

Napi::Value ImageProcessor::ProcessFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsBuffer()) {
        Napi::TypeError::New(env, "First argument must be a buffer").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Buffer<unsigned char> buffer = info[0].As<Napi::Buffer<unsigned char>>();
    
    // Safety check: reject buffers that are too large
    if (buffer.Length() > 50 * 1024 * 1024) { // 50MB limit
        Napi::Error::New(env, "Buffer too large").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Decode BMP
    auto newFrame = DecodeBMP(buffer.Data(), buffer.Length());
    if (!newFrame) {
        return env.Null();
    }
    
    // Safety check: reject images that are too large
    if (newFrame->width > 10000 || newFrame->height > 10000) {
        return env.Null();
    }
    
    // Check if we have a previous frame to compare
    if (!lastFrame_) {
        lastFrame_ = std::move(newFrame);
        return env.Null();
    }
    
    // Compare frames
    size_t diffPixels = CompareImages(*newFrame, *lastFrame_);
    
    // Update last frame
    lastFrame_ = std::move(newFrame);
    
    // Return encoded frame if threshold exceeded
    if (diffPixels > diffThreshold_) {
        auto jpegData = EncodeJPEG(*lastFrame_);
        if (!jpegData.empty()) {
            return Napi::Buffer<unsigned char>::Copy(env, jpegData.data(), jpegData.size());
        }
    }
    
    return env.Null();
}

Napi::Value ImageProcessor::GetLastFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!lastFrame_) {
        return env.Null();
    }
    
    auto jpegData = EncodeJPEG(*lastFrame_);
    if (!jpegData.empty()) {
        return Napi::Buffer<unsigned char>::Copy(env, jpegData.data(), jpegData.size());
    }
    
    return env.Null();
}

namespace ImageProc {
    Napi::Value CreateProcessor(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (g_processor) {
            delete g_processor;
        }
        g_processor = new ImageProcessor();
        return env.Null();
    }
    
    Napi::Value ProcessFrame(const Napi::CallbackInfo& info) {
        if (!g_processor) {
            Napi::Error::New(info.Env(), "ImageProcessor not initialized").ThrowAsJavaScriptException();
            return info.Env().Null();
        }
        return g_processor->ProcessFrame(info);
    }
    
    Napi::Value GetLastFrame(const Napi::CallbackInfo& info) {
        if (!g_processor) {
            Napi::Error::New(info.Env(), "ImageProcessor not initialized").ThrowAsJavaScriptException();
            return info.Env().Null();
        }
        return g_processor->GetLastFrame(info);
    }
    
    Napi::Object Init(Napi::Env env, Napi::Object exports) {
        exports.Set(Napi::String::New(env, "createProcessor"), Napi::Function::New(env, ImageProc::CreateProcessor));
        exports.Set(Napi::String::New(env, "processFrame"), Napi::Function::New(env, ImageProc::ProcessFrame));
        exports.Set(Napi::String::New(env, "getLastFrame"), Napi::Function::New(env, ImageProc::GetLastFrame));
        return exports;
    }
}
