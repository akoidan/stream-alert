#pragma once

#include <napi.h>
#include <string>
#include <vector>
#include <mutex>
#include <atomic>
#include <memory>
#include "../../common/common.h"

// Forward declarations
struct v4l2_format;
struct v4l2_buffer;
struct buffer;

class LinuxCapture {
public:
    LinuxCapture();
    ~LinuxCapture();

    bool OpenDevice(const std::string& deviceName);
    bool StartCapture(int width, int height, int fps);
    void StopCapture();
    FrameData* GetFrame();
    bool IsCapturing() const { return isCapturing_; }
    const std::string& GetDeviceName() const { return deviceName_; }
    
private:
    bool InitDevice(int width, int height, int fps);
    bool UninitDevice();
    bool StartStreaming();
    bool StopStreaming();
    bool ProcessFrame(const void* p, int size);
    
    // V4L2 helper functions
    int xioctl(int fd, unsigned long request, void* arg) const;
    bool SetImageFormat(v4l2_format& fmt, int width, int height);
    bool RequestBuffers();
    bool QueueBuffer(v4l2_buffer& buf);
    bool DequeueBuffer(v4l2_buffer& buf);
    
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
};

// N-API functions
namespace Capture {
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value GetFrame(const Napi::CallbackInfo& info);
}
