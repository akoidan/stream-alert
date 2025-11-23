#include "capture.h"
#include "../../shared/common/common.h"
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <linux/videodev2.h>
#include <string.h>
#include <errno.h>
#include <thread>
#include <chrono>
#include <iostream>
#include <cstring>
#include <fstream>
#include <sstream>
#include <map>
#include <algorithm>
#include <array>
#include <vector>
#include <setjmp.h>
#include <stdexcept>

#include <jpeglib.h>

#include "../../shared/logger/logger.h"

namespace {
    inline uint8_t ClampToByte(int value) {
        return static_cast<uint8_t>(std::min(std::max(value, 0), 255));
    }

    inline std::array<uint8_t, 3> YuvToRgb(uint8_t y, uint8_t u, uint8_t v) {
        int c = static_cast<int>(y) - 16;
        int d = static_cast<int>(u) - 128;
        int e = static_cast<int>(v) - 128;

        int r = (298 * c + 409 * e + 128) >> 8;
        int g = (298 * c - 100 * d - 208 * e + 128) >> 8;
        int b = (298 * c + 516 * d + 128) >> 8;

        return {ClampToByte(r), ClampToByte(g), ClampToByte(b)};
    }

    struct JpegErrorManager {
        jpeg_error_mgr pub;
        jmp_buf setjmpBuffer;
    };

    void JpegErrorExit(j_common_ptr cinfo) {
        auto* err = reinterpret_cast<JpegErrorManager*>(cinfo->err);
        (*cinfo->err->output_message)(cinfo);
        longjmp(err->setjmpBuffer, 1);
    }
}

using namespace std;

// Buffer structure for V4L2
struct buffer {
    void* start;
    size_t length;
};

void LinuxCapture::SetEnv(Napi::Env env) {
    env_ = env;
}

[[noreturn]] void LinuxCapture::ThrowError(const std::string& message) const {
    if (env_ != nullptr) {
        throw Napi::Error::New(Napi::Env(env_), message);
    }
    throw std::runtime_error(message);
}

[[noreturn]] void LinuxCapture::ThrowSystemError(const std::string& message, int err) const {
    std::ostringstream oss;
    oss << message;
    if (err != 0) {
        oss << ": (" << err << ") " << strerror(err);
    }
    ThrowError(oss.str());
}

LinuxCapture::LinuxCapture() = default;

LinuxCapture::~LinuxCapture() {
    try {
        StopCapture();
    } catch (const Napi::Error& err) {
        LOG_LNX_ERR("StopCapture raised error during destruction: " << err.Message());
    } catch (const std::exception& err) {
        LOG_LNX_ERR("StopCapture raised error during destruction: " << err.what());
    }

    if (fd_ >= 0) {
        close(fd_);
        fd_ = -1;
    }
}

// Helper function to get a map of available camera names to device paths
static map<string, string> GetAvailableCameras() {
    map<string, string> cameras;

    // Execute v4l2-ctl command to list devices
    FILE* pipe = popen("v4l2-ctl --list-devices 2>&1", "r");
    if (!pipe) {
        LOG_LNX_ERR("Failed to execute v4l2-ctl");
        return cameras;
    }

    char buffer[256];
    string currentName;

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        string line(buffer);
        // Remove trailing newline
        if (!line.empty() && line[line.length() - 1] == '\n') {
            line.erase(line.length() - 1);
        }

        // If line contains a colon, it's a device name
        if (line.find(':') != string::npos) {
            currentName = line.substr(0, line.find(':'));
        }
        // If line starts with /dev/video, it's a device path
        else if (line.find("/dev/video") == 0 && !currentName.empty()) {
            // Only add if we don't have this camera yet
            if (cameras.find(currentName) == cameras.end()) {
                cameras[currentName] = line;
            }
        }
    }

    pclose(pipe);
    return cameras;
}

void LinuxCapture::OpenDevice(const string& deviceName) {
    // First, get all available cameras
    auto cameras = GetAvailableCameras();

    // Debug: Print all available cameras
    LOG_LNX("Available cameras:");
    for (const auto& cam : cameras) {
        LOG_LNX("  " << cam.first << " -> " << cam.second);
    }

    string devicePath;

    // Try to find the requested camera by name
    auto it = cameras.find(deviceName);
    if (it != cameras.end()) {
        // Found by exact name
        devicePath = it->second;
    } else {
        // Try case-insensitive search
        for (const auto& cam : cameras) {
            string lowerCamName = cam.first;
            string lowerDeviceName = deviceName;

            // Convert to lowercase for case-insensitive comparison
            transform(lowerCamName.begin(), lowerCamName.end(), lowerCamName.begin(), ::tolower);
            transform(lowerDeviceName.begin(), lowerDeviceName.end(), lowerDeviceName.begin(), ::tolower);

            if (lowerCamName.find(lowerDeviceName) != string::npos) {
                devicePath = cam.second;
                break;
            }
        }

        // If still not found, try to use the input as a direct path
        if (devicePath.empty()) {
            devicePath = deviceName;
        }
    }

    LOG_LNX("Using device path: " << devicePath);
    deviceName_ = devicePath;  // Store the actual device path

    // Try to open the device
    fd_ = open(devicePath.c_str(), O_RDWR | O_NONBLOCK);
    if (fd_ < 0) {
        int err = errno;
        LOG_LNX_ERR("Failed to open device " << devicePath << ": " << strerror(err));
        ThrowSystemError("Failed to open device " + devicePath, err);
    }
}

void LinuxCapture::StartCapture(int width, int height, int fps) {
    LOG_LNX("Starting capture with resolution: " << width << "x" << height << " at " << fps << "fps");

    if (isCapturing_) {
        LOG_LNX("Already capturing, stopping first...");
        StopCapture();
    }

    width_ = width;
    height_ = height;
    fps_ = fps;

    InitDevice(width, height, fps);

    LOG_LNX("Device initialized, starting streaming...");
    StartStreaming();

    isCapturing_ = true;
    LOG_LNX("Capture started successfully");
}

void LinuxCapture::StopCapture() {
    if (!isCapturing_) return;

    LOG_LNX("Stopping capture...");
    isCapturing_ = false;
    StopStreaming();
    UninitDevice();
}

void LinuxCapture::InitDevice(int width, int height, int fps) {
    LOG_LNX("Initializing device with resolution: " << width << "x" << height);

    // First, get the current format to see what's supported
    v4l2_format fmt = {};
    fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;

    if (xioctl(fd_, VIDIOC_G_FMT, &fmt) == -1) {
        int err = errno;
        LOG_LNX_ERR("Failed to get current format: " << strerror(err));
        ThrowSystemError("Failed to get current format", err);
    }

    LOG_LNX("Current format: "
            << (char)(fmt.fmt.pix.pixelformat & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 8) & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 16) & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 24) & 0xFF)
            << " (" << fmt.fmt.pix.width << "x" << fmt.fmt.pix.height << ")");

    // Try to set the requested format
    fmt.fmt.pix.width = width;
    fmt.fmt.pix.height = height;
    fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_MJPEG;  // Prefer MJPEG
    fmt.fmt.pix.field = V4L2_FIELD_ANY;

    LOG_LNX("Requesting format: MJPEG " << width << "x" << height);
    if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
        int err = errno;
        LOG_LNX_ERR("Failed to set MJPEG format: " << strerror(err));

        // Fall back to YUYV
        fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
        LOG_LNX("Falling back to YUYV format");

        if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
            int fallbackErr = errno;
            LOG_LNX_ERR("Failed to set YUYV format: " << strerror(fallbackErr));
            ThrowSystemError("Failed to configure capture format", fallbackErr);
        }
    }

    // Check what format we actually got
    LOG_LNX("Set format to: "
            << (char)(fmt.fmt.pix.pixelformat & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 8) & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 16) & 0xFF)
            << (char)((fmt.fmt.pix.pixelformat >> 24) & 0xFF)
            << " (" << fmt.fmt.pix.width << "x" << fmt.fmt.pix.height << ")");

    pixelFormat_ = fmt.fmt.pix.pixelformat;

    // Set frame rate
    v4l2_streamparm parm = {};
    parm.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    parm.parm.capture.timeperframe.numerator = 1;
    parm.parm.capture.timeperframe.denominator = fps;

    LOG_LNX("Setting frame rate to " << fps << "fps");
    if (xioctl(fd_, VIDIOC_S_PARM, &parm) == -1) {
        LOG_LNX_ERR("Failed to set frame rate (continuing anyway): " << strerror(errno));
    }

    // Request buffers
    LOG_LNX("Requesting video buffers...");
    RequestBuffers();
}

void LinuxCapture::UninitDevice() {
    LOG_LNX("Uninitializing device, releasing " << buffers_.size() << " buffers");

    for (size_t i = 0; i < buffers_.size(); ++i) {
        if (buffers_[i]) {
            if (buffers_[i]->start && buffers_[i]->length > 0) {
                if (munmap(buffers_[i]->start, buffers_[i]->length) == -1) {
                    int err = errno;
                    LOG_LNX_ERR("Failed to munmap buffer " << i << ": (" << err << ") " << strerror(err));
                } else {
                    LOG_LNX("Unmapped buffer " << i);
                }
            }
            delete buffers_[i];
        }
    }

    buffers_.clear();
}

void LinuxCapture::RequestBuffers() {
    // Request 4 buffers
    v4l2_requestbuffers req = {};
    req.count = 4;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;

    if (xioctl(fd_, VIDIOC_REQBUFS, &req) == -1) {
        int err = errno;
        LOG_LNX_ERR("VIDIOC_REQBUFS failed: (" << err << ") " << strerror(err));
        ThrowSystemError("VIDIOC_REQBUFS failed", err);
    }

    if (req.count == 0) {
        LOG_LNX_ERR("VIDIOC_REQBUFS returned zero buffers");
        ThrowError("VIDIOC_REQBUFS returned zero buffers");
    }

    LOG_LNX("Driver allocated " << req.count << " buffers");

    // Map the buffers
    for (unsigned int i = 0; i < req.count; ++i) {
        v4l2_buffer buf = {};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;

        if (xioctl(fd_, VIDIOC_QUERYBUF, &buf) == -1) {
            int err = errno;
            LOG_LNX_ERR("VIDIOC_QUERYBUF failed for buffer " << i << ": (" << err << ") " << strerror(err));
            ThrowSystemError("VIDIOC_QUERYBUF failed", err);
        }

        buffer* b = new buffer();
        b->length = buf.length;
        b->start = mmap(NULL, buf.length, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, buf.m.offset);

        if (b->start == MAP_FAILED) {
            int err = errno;
            LOG_LNX_ERR("Failed to mmap buffer " << i << ": (" << err << ") " << strerror(err));
            delete b;
            ThrowSystemError("Failed to mmap buffer", err);
        }

        buffers_.push_back(b);
        LOG_LNX("Mapped buffer " << i << " of length " << b->length);
    }
}

void LinuxCapture::StartStreaming() {
    if (buffers_.empty()) {
        LOG_LNX_ERR("StartStreaming: No buffers available for streaming");
        ThrowError("No buffers available for streaming");
    }

    LOG_LNX("Starting video stream with " << buffers_.size() << " buffers...");
    
    // Queue all buffers
    for (size_t i = 0; i < buffers_.size(); ++i) {
        v4l2_buffer buf = {};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;

        LOG_LNX("Queueing buffer " << i << "...");
        QueueBuffer(buf);
        LOG_LNX("Queued buffer " << i << " successfully");
    }

    // Start streaming
    enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    LOG_LNX("Starting video capture...");
    if (xioctl(fd_, VIDIOC_STREAMON, &type) == -1) {
        int err = errno;
        LOG_LNX_ERR("Failed to start streaming: (" << err << ") " << strerror(err));
        ThrowSystemError("Failed to start streaming", err);
    }

    LOG_LNX("Video streaming started successfully");
}

void LinuxCapture::StopStreaming() {
    enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    if (xioctl(fd_, VIDIOC_STREAMOFF, &type) == -1) {
        int err = errno;
        LOG_LNX_ERR("Failed to stop streaming: (" << err << ") " << strerror(err));
        ThrowSystemError("Failed to stop streaming", err);
    }
}

int LinuxCapture::xioctl(int fd, unsigned long request, void* arg) const {
    int r;
    do {
        r = ioctl(fd, request, arg);
    } while (r == -1 && (errno == EINTR || errno == EAGAIN));
    return r;
}

void LinuxCapture::QueueBuffer(v4l2_buffer& buf) {
    int ret = xioctl(fd_, VIDIOC_QBUF, &buf);
    if (ret == -1) {
        int err = errno;
        LOG_LNX_ERR("VIDIOC_QBUF failed for buffer " << buf.index << ": (" << err << ") " << strerror(err));
        ThrowSystemError("VIDIOC_QBUF failed", err);
    }
}

void LinuxCapture::DequeueBuffer(v4l2_buffer& buf) {
    int ret = xioctl(fd_, VIDIOC_DQBUF, &buf);
    if (ret == -1) {
        int err = errno;
        LOG_LNX_ERR("VIDIOC_DQBUF failed: (" << err << ") " << strerror(err));
        ThrowSystemError("VIDIOC_DQBUF failed", err);
    }
//     LOG_LNX("Dequeued buffer " << buf.index << " with " << buf.bytesused << " bytes used");
}

FrameData* LinuxCapture::GetFrame() {
    if (!isCapturing_) {
        return nullptr;
    }

//     LOG_LNX("Waiting for frame...");

    fd_set fds;
    FD_ZERO(&fds);
    FD_SET(fd_, &fds);

    struct timeval tv;
    tv.tv_sec = 2;
    tv.tv_usec = 0;
    tv.tv_sec = 2; // 2 second timeout

    int r = select(fd_ + 1, &fds, NULL, NULL, &tv);
    if (r == -1) {
        int err = errno;
        LOG_LNX_ERR("select() failed while waiting for frame: (" << err << ") " << strerror(err));
        return nullptr;
    }

    if (r == 0) {
        LOG_LNX_ERR("select() timeout waiting for frame");
        return nullptr; // Timeout
    }

    v4l2_buffer buf = {};
    buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    buf.memory = V4L2_MEMORY_MMAP;

    DequeueBuffer(buf);

    // Process the frame
    FrameData* frame = new FrameData();
    frame->width = width_;
    frame->height = height_;

    if (pixelFormat_ == V4L2_PIX_FMT_YUYV) {
        size_t expectedSize = static_cast<size_t>(width_) * static_cast<size_t>(height_) * 3;
        frame->buffer.resize(expectedSize);
        const uint8_t* src = static_cast<uint8_t*>(buffers_[buf.index]->start);
        uint8_t* dst = frame->buffer.data();

        for (int y = 0; y < height_; ++y) {
            for (int x = 0; x < width_; x += 2) {
                size_t yuyvIndex = (y * width_ + x) * 2;
                uint8_t y0 = src[yuyvIndex + 0];
                uint8_t u  = src[yuyvIndex + 1];
                uint8_t y1 = src[yuyvIndex + 2];
                uint8_t v  = src[yuyvIndex + 3];

                auto rgb0 = YuvToRgb(y0, u, v);
                auto rgb1 = YuvToRgb(y1, u, v);

                size_t rgbIndex = (static_cast<size_t>(y) * width_ + x) * 3;
                dst[rgbIndex + 0] = rgb0[0];
                dst[rgbIndex + 1] = rgb0[1];
                dst[rgbIndex + 2] = rgb0[2];
                dst[rgbIndex + 3] = rgb1[0];
                dst[rgbIndex + 4] = rgb1[1];
                dst[rgbIndex + 5] = rgb1[2];
            }
        }

        frame->dataSize = frame->buffer.size();
    } else if (pixelFormat_ == V4L2_PIX_FMT_MJPEG) {
        const uint8_t* mjpegData = static_cast<uint8_t*>(buffers_[buf.index]->start);
        size_t mjpegSize = buf.bytesused;

        JpegErrorManager jerr;
        jpeg_decompress_struct cinfo;
        cinfo.err = jpeg_std_error(&jerr.pub);
        jerr.pub.error_exit = JpegErrorExit;

        if (setjmp(jerr.setjmpBuffer)) {
            jpeg_destroy_decompress(&cinfo);
            LOG_LNX_ERR("Failed to decode MJPEG frame");
            delete frame;
            return nullptr;
        }

        jpeg_create_decompress(&cinfo);
        jpeg_mem_src(&cinfo, const_cast<unsigned char*>(mjpegData), static_cast<unsigned long>(mjpegSize));

        if (jpeg_read_header(&cinfo, TRUE) != JPEG_HEADER_OK) {
            jpeg_destroy_decompress(&cinfo);
            LOG_LNX_ERR("Invalid MJPEG header");
            delete frame;
            return nullptr;
        }

        cinfo.out_color_space = JCS_RGB;

        jpeg_start_decompress(&cinfo);

        if (static_cast<int>(cinfo.output_width) != width_ || static_cast<int>(cinfo.output_height) != height_) {
            LOG_LNX_ERR("MJPEG dimensions mismatch: expected " << width_ << "x" << height_
                         << ", got " << cinfo.output_width << "x" << cinfo.output_height);
        }

        size_t rowStride = cinfo.output_width * cinfo.output_components;
        frame->buffer.resize(static_cast<size_t>(cinfo.output_height) * rowStride);

        while (cinfo.output_scanline < cinfo.output_height) {
            unsigned char* rowPtr = frame->buffer.data() + cinfo.output_scanline * rowStride;
            jpeg_read_scanlines(&cinfo, &rowPtr, 1);
        }

        jpeg_finish_decompress(&cinfo);
        jpeg_destroy_decompress(&cinfo);

        frame->dataSize = frame->buffer.size();
    } else {
        // Unknown format, copy raw data as-is
        frame->buffer.resize(buf.bytesused);
        memcpy(frame->buffer.data(), buffers_[buf.index]->start, buf.bytesused);
        frame->dataSize = frame->buffer.size();
    }

//     LOG_LNX("Captured frame from buffer " << buf.index
//             << " (" << frame->dataSize << " bytes, " << frame->width
//             << "x" << frame->height << ")");

    // Requeue the buffer
    try {
        QueueBuffer(buf);
    } catch (const std::exception& err) {
        LOG_LNX_ERR("Failed to requeue buffer " << buf.index << ": " << err.what());
    }

    return frame;
}

// N-API Implementation
namespace Capture {
    static std::unique_ptr<LinuxCapture> g_capture;
    static std::thread g_captureThread;
    static std::atomic<bool> g_isCapturing{false};
    static Napi::ThreadSafeFunction g_callbackFunction;

    Napi::Value Start(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsFunction()) {
            Napi::TypeError::New(env, "Expected deviceName (string), frameRate (number), and callback (function)")
                .ThrowAsJavaScriptException();
            return env.Null();
        }

        std::string deviceName = info[0].As<Napi::String>();
        int frameRate = info[1].As<Napi::Number>().Int32Value();
        
        // Store the callback
        g_callbackFunction = Napi::ThreadSafeFunction::New(
            env,
            info[2].As<Napi::Function>(),
            "FrameCallback",
            0,
            1
        );

        // Create and start capture
        g_capture = std::make_unique<LinuxCapture>();
        g_capture->SetEnv(env);

        try {
            LOG_LNX("Attempting to open device: " << deviceName);
            g_capture->OpenDevice(deviceName);
            LOG_LNX("Successfully opened device: " << g_capture->GetDeviceName());

            // Start capture with default resolution
            g_capture->StartCapture(640, 480, frameRate);
        } catch (const Napi::Error& error) {
            g_isCapturing = false;
            g_capture.reset();
            g_callbackFunction.Release();
            error.ThrowAsJavaScriptException();
            return env.Null();
        } catch (const std::exception& error) {
            g_isCapturing = false;
            g_capture.reset();
            g_callbackFunction.Release();
            Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
            return env.Null();
        }

        // Start capture thread
        g_isCapturing = true;
        g_captureThread = std::thread([]() {
            while (Capture::g_isCapturing) {
                FrameData* frame = nullptr;
                try {
                    frame = Capture::g_capture->GetFrame();
                } catch (const Napi::Error& error) {
                    LOG_LNX_ERR("GetFrame error: " << error.Message());
                } catch (const std::exception& error) {
                    LOG_LNX_ERR("GetFrame error: " << error.what());
                }

                if (frame) {
                    auto callback = [](Napi::Env env, Napi::Function jsCallback, FrameData* frameData) {
                        if (frameData) {
                            // Create a buffer from the frame data
                            Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
                                env, 
                                frameData->buffer.data(), 
                                frameData->buffer.size()
                            );
                            
                            // Create result object
                            Napi::Object result = Napi::Object::New(env);
                            result.Set("buffer", buffer);
                            result.Set("width", frameData->width);
                            result.Set("height", frameData->height);
                            result.Set("dataSize", static_cast<double>(frameData->dataSize));
                            
                            // Call the JavaScript callback
                            jsCallback.Call({ result });
                            
                            // Clean up
                            delete frameData;
                        }
                    };
                    
                    // Create a copy of the frame data for the callback
                    FrameData* frameCopy = new FrameData();
                    frameCopy->buffer = frame->buffer;
                    frameCopy->width = frame->width;
                    frameCopy->height = frame->height;
                    frameCopy->dataSize = frame->dataSize;
                    
                    Capture::g_callbackFunction.BlockingCall(frameCopy, callback);
                    delete frame;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(1000 / 30)); // 30 FPS
            }
        });

        return env.Undefined();
    }

    Napi::Value Stop(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        Capture::g_isCapturing = false;
        if (Capture::g_captureThread.joinable()) {
            Capture::g_captureThread.join();
        }
        
        try {
            if (Capture::g_capture) {
                Capture::g_capture->StopCapture();
                Capture::g_capture.reset();
            }
        } catch (const Napi::Error& error) {
            Capture::g_capture.reset();
            Capture::g_callbackFunction.Release();
            error.ThrowAsJavaScriptException();
            return env.Null();
        } catch (const std::exception& error) {
            Capture::g_capture.reset();
            Capture::g_callbackFunction.Release();
            Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
            return env.Null();
        }
        
        Capture::g_callbackFunction.Release();
        
        return env.Undefined();
    }

    Napi::Value GetFrame(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (!Capture::g_capture) {
            return env.Null();
        }
        
        auto frame = Capture::g_capture->GetFrame();
        if (!frame) {
            return env.Null();
        }
        
        // Create a buffer from the frame data
        Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
            env, 
            frame->buffer.data(), 
            frame->buffer.size()
        );
        
        // Create result object
        Napi::Object result = Napi::Object::New(env);
        result.Set("buffer", buffer);
        result.Set("width", frame->width);
        result.Set("height", frame->height);
        result.Set("dataSize", static_cast<double>(frame->dataSize));
        
        // Clean up
        delete frame;
        
        return result;
    }


}
