#pragma once

#include <napi.h>
#include <windows.h>
#include <dshow.h>
#include <vector>
#include <mutex>

// Import qedit.dll for SampleGrabber interface
#import "qedit.dll" raw_interfaces_only named_guids

// For some reason, these are not included in the
// DirectShow headers. However, they are exported
// by strmiids.lib, so I'm just declaring them
// here as extern.
EXTERN_C const CLSID CLSID_NullRenderer;
EXTERN_C const CLSID CLSID_SampleGrabber;

#pragma comment(lib, "strmiids.lib")

// Global variables for DirectShow
extern IGraphBuilder* g_graphBuilder;
extern IMediaControl* g_mediaControl;
extern IBaseFilter* g_videoFilter;
extern DexterLib::ISampleGrabber* g_sampleGrabber;
extern IBaseFilter* g_grabberFilter;

// Frame data
extern std::vector<uint8_t> g_frameData;
extern std::mutex g_frameMutex;
extern bool g_isCapturing;

// Callback reference
extern Napi::ThreadSafeFunction g_callbackFunction;

// Cleanup DirectShow resources
void CleanupDirectShow();

// Initialize DirectShow and start capture
void StartCapture(const std::string& deviceName, int fps);

// Stop capture
void StopCapture();

// N-API functions
namespace Capture {
    // Start capture with device name, fps, and callback
    Napi::Value Start(const Napi::CallbackInfo& info);
    
    // Stop capture
    Napi::Value Stop(const Napi::CallbackInfo& info);
    
    // Get latest frame
    Napi::Value GetFrame(const Napi::CallbackInfo& info);
}

// Initialize module
Napi::Object InitCapture(Napi::Env env, Napi::Object exports);
