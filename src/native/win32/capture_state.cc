#include "headers/capture_state.h"

IGraphBuilder* g_graphBuilder = nullptr;
IMediaControl* g_mediaControl = nullptr;
IBaseFilter* g_videoFilter = nullptr;
DexterLib::ISampleGrabber* g_sampleGrabber = nullptr;
IBaseFilter* g_grabberFilter = nullptr;

std::vector<uint8_t> g_frameData;
std::mutex g_frameMutex;
bool g_isCapturing = false;
bool g_hasMediaInfo = false;
bool g_captureFormatIsYuy2 = false;
Napi::ThreadSafeFunction g_callbackFunction;
BITMAPINFOHEADER g_bitmapInfoHeader = {};
int g_frameWidth = 0;
int g_frameHeight = 0;
std::atomic<uint64_t> g_rawSamples{0};
std::chrono::steady_clock::time_point g_lastCallbackTime;
int g_targetFps = 30;

namespace {
    template <typename T>
    void ReleaseComPtr(T*& ptr) {
        if (ptr) {
            ptr->Release();
            ptr = nullptr;
        }
    }
}

void ReleaseCallbackFunction() {
    if (!g_callbackFunction) {
        return;
    }

    g_callbackFunction.Release();
    g_callbackFunction = nullptr;
}

void InitializeFrameTiming(int fps) {
    g_targetFps = fps;
    auto startTime = std::chrono::steady_clock::now();
    if (g_targetFps > 0) {
        g_lastCallbackTime = startTime - std::chrono::milliseconds(1000 / g_targetFps);
    } else {
        g_lastCallbackTime = startTime;
    }
}

void ResetFrameMetadata() {
    g_frameWidth = 0;
    g_frameHeight = 0;
    g_frameData.clear();
    g_rawSamples.store(0);
    g_bitmapInfoHeader = {};
    g_hasMediaInfo = false;
    g_captureFormatIsYuy2 = false;
}

void CleanupDirectShow() {
    if (g_mediaControl) {
        g_mediaControl->Stop();
    }
    ReleaseComPtr(g_mediaControl);
    ReleaseComPtr(g_graphBuilder);
    ReleaseComPtr(g_videoFilter);
    ReleaseComPtr(g_sampleGrabber);
    ReleaseComPtr(g_grabberFilter);
    ResetFrameMetadata();
    CoUninitialize();
}
