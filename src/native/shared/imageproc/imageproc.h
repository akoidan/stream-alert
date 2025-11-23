#pragma once

#include <napi.h>
#include <vector>

struct SimpleImage {
    int width;
    int height;
    int components;
    std::vector<unsigned char> data;
};

namespace ImageProc {
    Napi::Value ConvertRgbToJpeg(const Napi::CallbackInfo& info);
    Napi::Value CompareRgbImages(const Napi::CallbackInfo& info);
    Napi::Object Init(Napi::Env env, Napi::Object exports);
}
