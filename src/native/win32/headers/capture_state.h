#pragma once

#include <napi.h>
#include <windows.h>
#include <dshow.h>
#include <vector>
#include <mutex>
#include <atomic>
#include <chrono>

// Import qedit.dll for SampleGrabber interface
#import "qedit.dll" raw_interfaces_only named_guids

extern IGraphBuilder* g_graphBuilder;
extern IMediaControl* g_mediaControl;
extern IBaseFilter* g_videoFilter;
extern DexterLib::ISampleGrabber* g_sampleGrabber;
extern IBaseFilter* g_grabberFilter;

extern std::vector<uint8_t> g_frameData;
extern std::mutex g_frameMutex;
extern bool g_isCapturing;
extern bool g_hasMediaInfo;
extern bool g_captureFormatIsYuy2;
extern Napi::ThreadSafeFunction g_callbackFunction;
extern BITMAPINFOHEADER g_bitmapInfoHeader;
extern int g_frameWidth;
extern int g_frameHeight;
extern std::atomic<uint64_t> g_rawSamples;
extern std::chrono::steady_clock::time_point g_lastCallbackTime;
extern int g_targetFps;

void ReleaseCallbackFunction();
void InitializeFrameTiming(int fps);
void ResetFrameMetadata();
void CleanupDirectShow();
