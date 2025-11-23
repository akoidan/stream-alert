#include "capture.h"
#include "../../common/common.h"
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

using namespace std;

// Buffer structure for V4L2
struct buffer {
    void* start;
    size_t length;
};

LinuxCapture::LinuxCapture() = default;

LinuxCapture::~LinuxCapture() {
    StopCapture();
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
        cerr << "Failed to execute v4l2-ctl" << endl;
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

bool LinuxCapture::OpenDevice(const string& deviceName) {
    // First, get all available cameras
    auto cameras = GetAvailableCameras();

    // Debug: Print all available cameras
    cout << "Available cameras:" << endl;
    for (const auto& cam : cameras) {
        cout << "  " << cam.first << " -> " << cam.second << endl;
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

    cout << "Using device path: " << devicePath << endl;
    deviceName_ = devicePath;  // Store the actual device path

    // Try to open the device
    fd_ = open(devicePath.c_str(), O_RDWR | O_NONBLOCK);
    if (fd_ < 0) {
        int err = errno;
        cerr << "Failed to open device " << devicePath
             << ": " << strerror(err) << endl;
        return false;
    }

    return true;
}

bool LinuxCapture::StartCapture(int width, int height, int fps) {
    cout << "Starting capture with resolution: " << width << "x" << height << " at " << fps << "fps" << endl;

    if (isCapturing_) {
        cout << "Already capturing, stopping first..." << endl;
        StopCapture();
    }

    width_ = width;
    height_ = height;
    fps_ = fps;

    if (!InitDevice(width, height, fps)) {
        cerr << "Failed to initialize device" << endl;
        return false;
    }

    cout << "Device initialized, starting streaming..." << endl;
    if (!StartStreaming()) {
        cerr << "Failed to start streaming" << endl;
        return false;
    }

    isCapturing_ = true;
    cout << "Capture started successfully" << endl;
    return true;
}

void LinuxCapture::StopCapture() {
    if (!isCapturing_) return;

    cout << "Stopping capture..." << endl;
    isCapturing_ = false;
    StopStreaming();
    UninitDevice();
}

bool LinuxCapture::InitDevice(int width, int height, int fps) {
    cout << "Initializing device with resolution: " << width << "x" << height << endl;

    // First, get the current format to see what's supported
    v4l2_format fmt = {};
    fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;

    if (xioctl(fd_, VIDIOC_G_FMT, &fmt) == -1) {
        cerr << "Failed to get current format: " << strerror(errno) << endl;
        return false;
    }

    cout << "Current format: "
         << (char)(fmt.fmt.pix.pixelformat & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 8) & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 16) & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 24) & 0xFF)
         << " (" << fmt.fmt.pix.width << "x" << fmt.fmt.pix.height << ")" << endl;

    // Try to set the requested format
    fmt.fmt.pix.width = width;
    fmt.fmt.pix.height = height;
    fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_MJPEG;  // Prefer MJPEG
    fmt.fmt.pix.field = V4L2_FIELD_ANY;

    cout << "Requesting format: MJPEG " << width << "x" << height << endl;
    if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
        cerr << "Failed to set MJPEG format: " << strerror(errno) << endl;

        // Fall back to YUYV
        fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
        cout << "Falling back to YUYV format" << endl;

        if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
            cerr << "Failed to set YUYV format: " << strerror(errno) << endl;
            return false;
        }
    }

    // Check what format we actually got
    cout << "Set format to: "
         << (char)(fmt.fmt.pix.pixelformat & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 8) & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 16) & 0xFF)
         << (char)((fmt.fmt.pix.pixelformat >> 24) & 0xFF)
         << " (" << fmt.fmt.pix.width << "x" << fmt.fmt.pix.height << ")" << endl;

    // Set frame rate
    v4l2_streamparm parm = {};
    parm.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    parm.parm.capture.timeperframe.numerator = 1;
    parm.parm.capture.timeperframe.denominator = fps;

    cout << "Setting frame rate to " << fps << "fps" << endl;
    if (xioctl(fd_, VIDIOC_S_PARM, &parm) == -1) {
        cerr << "Failed to set frame rate (continuing anyway): " << strerror(errno) << endl;
    }

    // Request buffers
    cout << "Requesting video buffers..." << endl;
    if (!RequestBuffers()) {
        cerr << "Failed to request buffers" << endl;
        return false;
    }

    return true;
}

bool LinuxCapture::UninitDevice() {
    cout << "Uninitializing device, releasing " << buffers_.size() << " buffers" << endl;

    for (size_t i = 0; i < buffers_.size(); ++i) {
        if (buffers_[i]) {
            if (buffers_[i]->start && buffers_[i]->length > 0) {
                if (munmap(buffers_[i]->start, buffers_[i]->length) == -1) {
                    int err = errno;
                    cerr << "Failed to munmap buffer " << i << ": (" << err << ") " << strerror(err) << endl;
                } else {
                    cout << "Unmapped buffer " << i << endl;
                }
            }
            delete buffers_[i];
        }
    }

    buffers_.clear();

    return true;
}

// Rest of the file remains the same...


bool LinuxCapture::SetImageFormat(v4l2_format& fmt, int width, int height) {
    fmt.fmt.pix.width = width;
    fmt.fmt.pix.height = height;
    fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_MJPEG; // Prefer MJPEG, fallback to YUYV if needed
    fmt.fmt.pix.field = V4L2_FIELD_ANY;

    if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
        // Try YUYV if MJPEG fails
        fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
        if (xioctl(fd_, VIDIOC_S_FMT, &fmt) == -1) {
            return false;
        }
    }

    return true;
}

bool LinuxCapture::RequestBuffers() {
    // Request 4 buffers
    v4l2_requestbuffers req = {};
    req.count = 4;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;

    if (xioctl(fd_, VIDIOC_REQBUFS, &req) == -1) {
        int err = errno;
        cerr << "VIDIOC_REQBUFS failed: (" << err << ") " << strerror(err) << endl;
        return false;
    }

    if (req.count == 0) {
        cerr << "VIDIOC_REQBUFS returned zero buffers" << endl;
        return false;
    }

    cout << "Driver allocated " << req.count << " buffers" << endl;

    // Map the buffers
    for (unsigned int i = 0; i < req.count; ++i) {
        v4l2_buffer buf = {};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;

        if (xioctl(fd_, VIDIOC_QUERYBUF, &buf) == -1) {
            int err = errno;
            cerr << "VIDIOC_QUERYBUF failed for buffer " << i << ": (" << err << ") " << strerror(err) << endl;
            return false;
        }

        buffer* b = new buffer();
        b->length = buf.length;
        b->start = mmap(NULL, buf.length, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, buf.m.offset);

        if (b->start == MAP_FAILED) {
            int err = errno;
            cerr << "Failed to mmap buffer " << i << ": (" << err << ") " << strerror(err) << endl;
            delete b;
            return false;
        }

        buffers_.push_back(b);
        cout << "Mapped buffer " << i << " of length " << b->length << endl;
    }

    return true;
}

bool LinuxCapture::StartStreaming() {
    if (buffers_.empty()) {
        cerr << "StartStreaming: No buffers available for streaming" << endl;
        return false;
    }

    cout << "Starting video stream with " << buffers_.size() << " buffers..." << endl;
    
    // Queue all buffers
    for (size_t i = 0; i < buffers_.size(); ++i) {
        v4l2_buffer buf = {};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;

        cout << "Queueing buffer " << i << "..." << endl;
        if (!QueueBuffer(buf)) {
            cerr << "Failed to queue buffer " << i << endl;
            return false;
        }
        cout << "Queued buffer " << i << " successfully" << endl;
    }

    // Start streaming
    enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    cout << "Starting video capture..." << endl;
    if (xioctl(fd_, VIDIOC_STREAMON, &type) == -1) {
        int err = errno;
        cerr << "Failed to start streaming: (" << err << ") " << strerror(err) << endl;
        return false;
    }

    cout << "Video streaming started successfully" << endl;
    return true;
}

bool LinuxCapture::StopStreaming() {
    enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    if (xioctl(fd_, VIDIOC_STREAMOFF, &type) == -1) {
        int err = errno;
        cerr << "Failed to stop streaming: (" << err << ") " << strerror(err) << endl;
        return false;
    }
    return true;
}

int LinuxCapture::xioctl(int fd, unsigned long request, void* arg) const {
    int r;
    do {
        r = ioctl(fd, request, arg);
    } while (r == -1 && (errno == EINTR || errno == EAGAIN));
    return r;
}

bool LinuxCapture::QueueBuffer(v4l2_buffer& buf) {
    int ret = xioctl(fd_, VIDIOC_QBUF, &buf);
    if (ret == -1) {
        int err = errno;
        cerr << "VIDIOC_QBUF failed for buffer " << buf.index << ": (" << err << ") " << strerror(err) << endl;
        return false;
    }
    return true;
}

bool LinuxCapture::DequeueBuffer(v4l2_buffer& buf) {
    int ret = xioctl(fd_, VIDIOC_DQBUF, &buf);
    if (ret == -1) {
        int err = errno;
        cerr << "VIDIOC_DQBUF failed: (" << err << ") " << strerror(err) << endl;
        return false;
    }
    cout << "Dequeued buffer " << buf.index << " with " << buf.bytesused << " bytes used" << endl;
    return true;
}

FrameData* LinuxCapture::GetFrame() {
    if (!isCapturing_) {
        return nullptr;
    }

    cout << "Waiting for frame..." << endl;

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
        cerr << "select() failed while waiting for frame: (" << err << ") " << strerror(err) << endl;
        return nullptr;
    }

    if (r == 0) {
        cerr << "select() timeout waiting for frame" << endl;
        return nullptr; // Timeout
    }

    v4l2_buffer buf = {};
    buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    buf.memory = V4L2_MEMORY_MMAP;

    if (!DequeueBuffer(buf)) {
        return nullptr;
    }

    // Process the frame
    FrameData* frame = new FrameData();
    frame->width = width_;
    frame->height = height_;
    frame->dataSize = buf.bytesused;
    frame->buffer.resize(buf.bytesused);
    memcpy(frame->buffer.data(), buffers_[buf.index]->start, buf.bytesused);

    cout << "Captured frame from buffer " << buf.index
         << " (" << frame->dataSize << " bytes, " << frame->width
         << "x" << frame->height << ")" << endl;

    // Requeue the buffer
    if (!QueueBuffer(buf)) {
        cerr << "Failed to requeue buffer " << buf.index << endl;
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
        std::cout << "Attempting to open device: " << deviceName << std::endl;
        
        if (!g_capture->OpenDevice(deviceName)) {
            std::string errorMsg = "Failed to open device: " + deviceName + " (tried " + g_capture->GetDeviceName() + ")";
            std::cerr << errorMsg << std::endl;
            Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
            return env.Null();
        }
        
        std::cout << "Successfully opened device: " << g_capture->GetDeviceName() << std::endl;

        // Start capture with default resolution
        if (!g_capture->StartCapture(640, 480, frameRate)) {
            Napi::Error::New(env, "Failed to start capture")
                .ThrowAsJavaScriptException();
            return env.Null();
        }

        // Start capture thread
        g_isCapturing = true;
        g_captureThread = std::thread([]() {
            while (Capture::g_isCapturing) {
                auto frame = Capture::g_capture->GetFrame();
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
        
        if (Capture::g_capture) {
            Capture::g_capture->StopCapture();
            Capture::g_capture.reset();
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
