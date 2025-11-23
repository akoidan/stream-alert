#include "imageproc.h"

#include "../vendor/toojpeg.h"
#include "../vendor/toojpeg.cpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace {
    // Global context for JPEG writing
    std::vector<unsigned char>* g_jpegContext = nullptr;

    // C-style callback for TooJPEG
    void jpegWriteCallback(unsigned char byte) {
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
        bool success = TooJpeg::writeJpeg(
            jpegWriteCallback,
            img.data.data(),
            static_cast<unsigned short>(img.width),
            static_cast<unsigned short>(img.height),
            true,   // isRGB
            85,     // quality
            false,  // downsample
            nullptr // comment
        );

        // Clear global context
        g_jpegContext = nullptr;

        if (!success) {
            throw std::runtime_error("JPEG encoding failed");
        }

        return jpegData;
    }

    // Compare two RGB images and return number of different pixels (ULTRA FAST - no decoding)
    size_t CompareRgbImagesDirect(const unsigned char* data1,
                                  const unsigned char* data2,
                                  int width,
                                  int height,
                                  double threshold) {
        const int thresholdInt = static_cast<int>(threshold * 255.0);

        size_t diffPixels = 0;
        const size_t totalPixels = static_cast<size_t>(width) * static_cast<size_t>(height);

        for (size_t i = 0; i < totalPixels; ++i) {
            const size_t pixelOffset = i * 3;

            const int rDiff = std::abs(static_cast<int>(data1[pixelOffset]) - static_cast<int>(data2[pixelOffset]));
            const int gDiff = std::abs(static_cast<int>(data1[pixelOffset + 1]) - static_cast<int>(data2[pixelOffset + 1]));
            const int bDiff = std::abs(static_cast<int>(data1[pixelOffset + 2]) - static_cast<int>(data2[pixelOffset + 2]));

            const int avgDiff = (rDiff + gDiff + bDiff) / 3;

            if (avgDiff > thresholdInt) {
                ++diffPixels;
            }
        }

        return diffPixels;
    }

    class ImageComparisonWorker : public Napi::AsyncWorker {
    public:
        ImageComparisonWorker(Napi::Function& callback,
                              std::vector<unsigned char> buffer1Data,
                              std::vector<unsigned char> buffer2Data,
                              int width,
                              int height,
                              double threshold,
                              Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(callback, "ImageComparisonWorker"),
              buffer1Data(std::move(buffer1Data)),
              buffer2Data(std::move(buffer2Data)),
              width(width),
              height(height),
              threshold(threshold),
              deferred(std::move(deferred)) {}

        void Execute() override {
            try {
                diffPixels = CompareRgbImagesDirect(
                    buffer1Data.data(),
                    buffer2Data.data(),
                    width,
                    height,
                    threshold
                );
            } catch (const std::exception& e) {
                SetError(e.what());
            }
        }

        void OnOK() override {
            Napi::Env env = Env();
            Napi::HandleScope scope(env);
            deferred.Resolve(Napi::Number::New(env, static_cast<double>(diffPixels)));
        }

        void OnError(const Napi::Error& e) override {
            Napi::Env env = Env();
            Napi::HandleScope scope(env);
            deferred.Reject(e.Value());
        }

    private:
        std::vector<unsigned char> buffer1Data;
        std::vector<unsigned char> buffer2Data;
        int width;
        int height;
        double threshold;
        size_t diffPixels{0};
        Napi::Promise::Deferred deferred;
    };

    class JpegConversionWorker : public Napi::AsyncWorker {
    public:
        JpegConversionWorker(Napi::Function& callback,
                             std::vector<unsigned char> bufferData,
                             int width,
                             int height,
                             Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(callback, "JpegConversionWorker"),
              bufferData(std::move(bufferData)),
              width(width),
              height(height),
              deferred(std::move(deferred)) {}

        void Execute() override {
            try {
                SimpleImage img;
                img.width = width;
                img.height = height;
                img.components = 3;
                img.data = bufferData;

                jpegResult = EncodeJPEG(img);
                if (jpegResult.empty()) {
                    SetError("Failed to encode JPEG image");
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            }
        }

        void OnOK() override {
            Napi::Env env = Env();
            Napi::HandleScope scope(env);
            deferred.Resolve(Napi::Buffer<unsigned char>::Copy(env, jpegResult.data(), jpegResult.size()));
        }

        void OnError(const Napi::Error& e) override {
            Napi::Env env = Env();
            Napi::HandleScope scope(env);
            deferred.Reject(e.Value());
        }

    private:
        std::vector<unsigned char> bufferData;
        std::vector<unsigned char> jpegResult;
        int width;
        int height;
        Napi::Promise::Deferred deferred;
    };
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

        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw Napi::RangeError::New(env, "Invalid image dimensions");
        }

        const size_t expectedSize = static_cast<size_t>(width) * static_cast<size_t>(height) * 3;
        if (buffer.Length() < expectedSize) {
            throw Napi::Error::New(env, "Buffer too small for specified dimensions");
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        Napi::Function dummyCallback = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});

        auto worker = new JpegConversionWorker(
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

        if (!info[0].IsBuffer() || !info[1].IsBuffer() || !info[2].IsNumber() ||
            !info[3].IsNumber() || !info[4].IsNumber()) {
            throw Napi::TypeError::New(env, "Arguments must be: buffer1, buffer2, width, height, threshold");
        }

        Napi::Buffer<unsigned char> buffer1 = info[0].As<Napi::Buffer<unsigned char>>();
        Napi::Buffer<unsigned char> buffer2 = info[1].As<Napi::Buffer<unsigned char>>();
        int width = info[2].As<Napi::Number>().Int32Value();
        int height = info[3].As<Napi::Number>().Int32Value();
        double threshold = info[4].As<Napi::Number>().DoubleValue();

        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
            throw Napi::RangeError::New(env, "Invalid image dimensions");
        }

        if (threshold < 0.0 || threshold > 1.0) {
            throw Napi::RangeError::New(env, "Threshold must be between 0 and 1");
        }

        const size_t expectedSize = static_cast<size_t>(width) * static_cast<size_t>(height) * 3;
        if (buffer1.Length() < expectedSize || buffer2.Length() < expectedSize) {
            throw Napi::Error::New(env, "Buffer too small for specified dimensions");
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        Napi::Function dummyCallback = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});

        auto worker = new ImageComparisonWorker(
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
        exports.Set(Napi::String::New(env, "convertRgbToJpeg"), Napi::Function::New(env, ConvertRgbToJpeg));
        exports.Set(Napi::String::New(env, "compareRgbImages"), Napi::Function::New(env, CompareRgbImages));
        return exports;
    }
}
