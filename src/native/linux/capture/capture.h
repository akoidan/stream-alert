#pragma once

#include <napi.h>
#include <string>
#include <vector>
#include <mutex>
#include <atomic>
#include <memory>
#include "common.h"

// Forward declarations
struct v4l2_format;
struct v4l2_buffer;
struct buffer;

class LinuxCapture {
public:
    LinuxCapture();
    ~LinuxCapture();

    void OpenDevice(const std::string& deviceName);
    void StartCapture(int width, int height, int fps);
    void StopCapture();
    FrameData* GetFrame();
    bool IsCapturing() const { return isCapturing_; }
    const std::string& GetDeviceName() const { return deviceName_; }
    void SetEnv(Napi::Env env);
    
private:
    void InitDevice(int width, int height, int fps);
    void UninitDevice();
    void StartStreaming();
    void StopStreaming();
    
    // V4L2 helper functions
    int xioctl(int fd, unsigned long request, void* arg) const;
    void RequestBuffers();
    void QueueBuffer(v4l2_buffer& buf);
    void DequeueBuffer(v4l2_buffer& buf);
    [[noreturn]] void ThrowSystemError(const std::string& message, int err) const;
    [[noreturn]] void ThrowError(const std::string& message) const;
    
    int fd_ = -1;
    std::vector<buffer*> buffers_;
    std::mutex frameMutex_;
    std::vector<uint8_t> frameData_;
    bool isCapturing_ = false;
    int width_ = 0;
    int height_ = 0;
    int fps_ = 0;
    uint32_t pixelFormat_ = 0;
    std::string deviceName_;
    napi_env env_ = nullptr;
};

// N-API functions
namespace Capture {
    Napi::Object Init(Napi::Env env, Napi::Object exports);
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value GetFrame(const Napi::CallbackInfo& info);
}
