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

// Simple BMP decoder for 24-bit BMPs (standard bottom-up format)
std::unique_ptr<SimpleImage> DecodeBMP(const unsigned char* buffer, size_t length) {
    if (length < 54) return nullptr; // BMP header is 54 bytes
    
    // Check BMP signature
    if (buffer[0] != 'B' || buffer[1] != 'M') return nullptr;
    
    auto img = std::make_unique<SimpleImage>();
    
    // Extract dimensions from BMP header
    img->width = *reinterpret_cast<const int*>(&buffer[18]);
    img->height = *reinterpret_cast<const int*>(&buffer[22]);
    img->components = 3; // RGB
    img->data.resize(img->width * img->height * 3);
    
    // Safety checks
    if (img->width <= 0 || img->height <= 0 || img->width > 10000 || img->height > 10000) {
        return nullptr;
    }
    
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

// Compare two images and return number of different pixels
size_t CompareImages(const SimpleImage& img1, const SimpleImage& img2, double threshold) {
    if (img1.width != img2.width || img1.height != img2.height || img1.components != img2.components) {
        throw std::runtime_error("Image dimensions do not match");
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
        if (avgDiff > threshold * 255.0) {
            diffPixels++;
        }
    }
    
    return diffPixels;
}

namespace ImageProc {
    Napi::Value ConvertBmpToJpeg(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Wrong number of arguments");
        }
        
        if (!info[0].IsBuffer()) {
            throw Napi::TypeError::New(env, "First argument must be a buffer");
        }
        
        Napi::Buffer<unsigned char> buffer = info[0].As<Napi::Buffer<unsigned char>>();
        
        // Safety check: reject buffers that are too large
        if (buffer.Length() > 50 * 1024 * 1024) { // 50MB limit
            throw Napi::Error::New(env, "Buffer too large");
        }
        
        // Decode BMP
        auto img = DecodeBMP(buffer.Data(), buffer.Length());
        if (!img) {
            throw Napi::Error::New(env, "Failed to decode BMP image");
        }
        
        // Encode JPEG
        auto jpegData = EncodeJPEG(*img);
        if (jpegData.empty()) {
            throw Napi::Error::New(env, "Failed to encode JPEG image");
        }
        
        return Napi::Buffer<unsigned char>::Copy(env, jpegData.data(), jpegData.size());
    }
    
    Napi::Value CompareBmpImages(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 3) {
            throw Napi::TypeError::New(env, "Wrong number of arguments");
        }
        
        if (!info[0].IsBuffer() || !info[1].IsBuffer()) {
            throw Napi::TypeError::New(env, "First two arguments must be buffers");
        }
        
        if (!info[2].IsNumber()) {
            throw Napi::TypeError::New(env, "Third argument must be a number (threshold)");
        }
        
        Napi::Buffer<unsigned char> buffer1 = info[0].As<Napi::Buffer<unsigned char>>();
        Napi::Buffer<unsigned char> buffer2 = info[1].As<Napi::Buffer<unsigned char>>();
        double threshold = info[2].As<Napi::Number>().DoubleValue();
        
        // Validate threshold
        if (threshold < 0.0 || threshold > 1.0) {
            throw Napi::RangeError::New(env, "Threshold must be between 0 and 1");
        }
        
        // Safety check: reject buffers that are too large
        if (buffer1.Length() > 50 * 1024 * 1024 || buffer2.Length() > 50 * 1024 * 1024) {
            throw Napi::Error::New(env, "Buffer too large");
        }
        
        // Decode BMPs
        auto img1 = DecodeBMP(buffer1.Data(), buffer1.Length());
        if (!img1) {
            throw Napi::Error::New(env, "Failed to decode first BMP image");
        }
        
        auto img2 = DecodeBMP(buffer2.Data(), buffer2.Length());
        if (!img2) {
            throw Napi::Error::New(env, "Failed to decode second BMP image");
        }
        
        // Compare images
        size_t diffPixels = CompareImages(*img1, *img2, threshold);
        
        return Napi::Number::New(env, static_cast<double>(diffPixels));
    }
    
    Napi::Object Init(Napi::Env env, Napi::Object exports) {
        exports.Set(Napi::String::New(env, "convertBmpToJpeg"), Napi::Function::New(env, ImageProc::ConvertBmpToJpeg));
        exports.Set(Napi::String::New(env, "compareBmpImages"), Napi::Function::New(env, ImageProc::CompareBmpImages));
        return exports;
    }
}
