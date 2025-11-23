#include "imageproc.h"
#include "../../shared/imageproc/imageproc.h"
#include "toojpeg.h"
#include "toojpeg.cpp"
#include <algorithm>
#include <cmath>
#include <thread>

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

// Async worker for image comparison
class ImageComparisonWorker : public Napi::AsyncWorker {
public:
    ImageComparisonWorker(Napi::Function& callback, 
                         const std::vector<unsigned char>& buffer1Data,
                         const std::vector<unsigned char>& buffer2Data,
                         int width, int height, double threshold,
                         Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(callback, "ImageComparisonWorker"),
          buffer1Data(buffer1Data),
          buffer2Data(buffer2Data),
          width(width), height(height), threshold(threshold),
          deferred(deferred) {}

    ~ImageComparisonWorker() {}

    // This runs on the worker thread
    void Execute() override {
        try {
            // Compare RGB images directly (this runs in the background thread)
            diffPixels = CompareRgbImagesDirect(buffer1Data.data(), buffer2Data.data(), width, height, threshold);
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }

    // This runs on the main thread after Execute() completes
    void OnOK() override {
        Napi::Env env = Env();
        Napi::HandleScope scope(env);
        
        // Resolve the promise with the result
        deferred.Resolve(Napi::Number::New(env, static_cast<double>(diffPixels)));
    }

    // This runs on the main thread if Execute() throws an error
    void OnError(const Napi::Error& e) override {
        Napi::Env env = Env();
        Napi::HandleScope scope(env);
        
        // Reject the promise with the error
        deferred.Reject(e.Value());
    }

private:
    std::vector<unsigned char> buffer1Data;
    std::vector<unsigned char> buffer2Data;
    std::vector<unsigned char> jpegResult;
    int width;
    int height;
    double threshold;
    size_t diffPixels;
    Napi::Promise::Deferred deferred;
};

// Async worker for JPEG conversion
class JpegConversionWorker : public Napi::AsyncWorker {
public:
    JpegConversionWorker(Napi::Function& callback, 
                         const std::vector<unsigned char>& bufferData,
                         int width, int height,
                         Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(callback, "JpegConversionWorker"),
          bufferData(bufferData),
          width(width), height(height),
          deferred(deferred) {}

    ~JpegConversionWorker() {}

    // This runs on the worker thread
    void Execute() override {
        try {
            // Create SimpleImage from RGB data
            SimpleImage img;
            img.width = width;
            img.height = height;
            img.components = 3;
            img.data = bufferData;
            
            // Encode JPEG (this runs in the background thread)
            jpegResult = EncodeJPEG(img);
            if (jpegResult.empty()) {
                SetError("Failed to encode JPEG image");
            }
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }

    // This runs on the main thread after Execute() completes
    void OnOK() override {
        Napi::Env env = Env();
        Napi::HandleScope scope(env);
        
        // Resolve the promise with the result
        deferred.Resolve(Napi::Buffer<unsigned char>::Copy(env, jpegResult.data(), jpegResult.size()));
    }

    // This runs on the main thread if Execute() throws an error
    void OnError(const Napi::Error& e) override {
        Napi::Env env = Env();
        Napi::HandleScope scope(env);
        
        // Reject the promise with the error
        deferred.Reject(e.Value());
    }

private:
    std::vector<unsigned char> bufferData;
    std::vector<unsigned char> jpegResult;
    int width;
    int height;
    Napi::Promise::Deferred deferred;
};

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
        
        // Create a promise
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        
        // Create a dummy callback for AsyncWorker (we won't use it but AsyncWorker requires it)
        Napi::Function dummyCallback = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});
        
        // Create and queue the async worker
        JpegConversionWorker* worker = new JpegConversionWorker(
            dummyCallback, 
            std::vector<unsigned char>(buffer.Data(), buffer.Data() + expectedSize),
            width, 
            height,
            deferred
        );
        
        worker->Queue();
        
        return deferred.Promise();
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
        
        // Create a promise
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        
        // Create a dummy callback for AsyncWorker (we won't use it but AsyncWorker requires it)
        Napi::Function dummyCallback = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});
        
        // Create and queue the async worker
        ImageComparisonWorker* worker = new ImageComparisonWorker(
            dummyCallback,
            std::vector<unsigned char>(buffer1.Data(), buffer1.Data() + expectedSize),
            std::vector<unsigned char>(buffer2.Data(), buffer2.Data() + expectedSize),
            width, 
            height,
            threshold,
            deferred
        );
        
        worker->Queue();
        
        return deferred.Promise();
    }
    
    Napi::Object Init(Napi::Env env, Napi::Object exports) {
        // RGB functions only - high performance processing
        exports.Set(Napi::String::New(env, "convertRgbToJpeg"), Napi::Function::New(env, ImageProc::ConvertRgbToJpeg));
        exports.Set(Napi::String::New(env, "compareRgbImages"), Napi::Function::New(env, ImageProc::CompareRgbImages));
        
        return exports;
    }
}
