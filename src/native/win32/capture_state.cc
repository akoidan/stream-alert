#include "headers/capture_state.h"
#include <Windows.h>
#include <iostream>

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
    std::cout << "[capture] Starting DirectShow cleanup..." << std::endl;
    
    if (g_mediaControl) {
        HRESULT hr = g_mediaControl->Stop();
        std::cout << "[capture] MediaControl::Stop() returned hr=" << std::hex << hr << std::dec << std::endl;
        
        // Wait for the graph to actually stop with longer timeout
        OAFilterState state = State_Running;
        int attempts = 0;
        while (state != State_Stopped && attempts < 50) {
            hr = g_mediaControl->GetState(200, &state);
            if (SUCCEEDED(hr)) {
                std::cout << "[capture] Graph state check " << attempts << ": " << state << std::endl;
            }
            attempts++;
        }
        
        if (state == State_Stopped) {
            std::cout << "[capture] Graph successfully stopped after " << attempts << " attempts." << std::endl;
        } else {
            std::cout << "[capture] Warning: Graph did not stop cleanly, final state: " << state << std::endl;
        }
    }
    
    // Add a longer delay to allow OBS Virtual Camera to release completely
    Sleep(500);
    
    ReleaseComPtr(g_mediaControl);
    ReleaseComPtr(g_graphBuilder);
    ReleaseComPtr(g_videoFilter);
    ReleaseComPtr(g_sampleGrabber);
    ReleaseComPtr(g_grabberFilter);
    ResetFrameMetadata();
    
    // Additional delay to ensure OBS Virtual Camera is fully released
    Sleep(200);
    
    std::cout << "[capture] DirectShow cleanup completed." << std::endl;
}
