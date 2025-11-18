#pragma once

#include <napi.h>
#include <windows.h>
#include <dshow.h>
#include <vector>
#include <thread>
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

// Node.js native API functions
Napi::Object InitCapture(Napi::Env env, Napi::Object exports);

namespace Capture {
    // DirectShow capture functions
    Napi::Value Initialize(const Napi::CallbackInfo& info);
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value GetFrame(const Napi::CallbackInfo& info);
}

// Global variables for DirectShow
extern IGraphBuilder* g_graphBuilder;
extern IMediaControl* g_mediaControl;
extern IBaseFilter* g_videoFilter;
extern DexterLib::ISampleGrabber* g_sampleGrabber;
extern IBaseFilter* g_grabberFilter;

// Frame data storage
extern std::vector<uint8_t> g_latestFrame;
extern std::mutex g_frameMutex;
extern bool g_shouldStop;
