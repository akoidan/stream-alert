#include "headers/capture.h"
#include "headers/capture_state.h"
#include "headers/capture_media.h"
#include "headers/capture_device.h"
#include "headers/capture_callback.h"
#include "headers/capture_format.h"

#include <chrono>
#include <iostream>
#include <string>
#include <Windows.h>

#pragma comment(lib, "strmiids.lib")

namespace {

[[noreturn]] void ThrowCaptureError(Napi::Env env, const char* message) {
    ReleaseCallbackFunction();
    throw Napi::Error::New(env, message);
}

std::wstring ToWide(const std::string& value) {
    return std::wstring(value.begin(), value.end());
}

void InitializeGraphBuilder(Napi::Env env) {
    HRESULT hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_IGraphBuilder, reinterpret_cast<void**>(&g_graphBuilder));
    if (FAILED(hr)) {
        ThrowCaptureError(env, "Failed to create graph builder");
    }

    hr = g_graphBuilder->QueryInterface(IID_IMediaControl, reinterpret_cast<void**>(&g_mediaControl));
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to get media control");
    }
}

ICaptureGraphBuilder2* CreateCaptureGraphBuilder(Napi::Env env) {
    ICaptureGraphBuilder2* captureBuilder = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_ICaptureGraphBuilder2, reinterpret_cast<void**>(&captureBuilder));
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to create capture graph builder");
    }

    hr = captureBuilder->SetFiltergraph(g_graphBuilder);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set filter graph");
    }

    return captureBuilder;
}

void AddVideoDeviceFilter(Napi::Env env, const std::wstring& deviceName) {
    g_videoFilter = FindCaptureDevice(deviceName);
    if (!g_videoFilter) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to find video capture device");
    }

    HRESULT hr = g_graphBuilder->AddFilter(g_videoFilter, L"Video Capture");
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to add video filter to graph");
    }
}

void AddSampleGrabberFilter(Napi::Env env) {
    HRESULT hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_IBaseFilter, reinterpret_cast<void**>(&g_grabberFilter));
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to create sample grabber filter");
    }

    hr = g_graphBuilder->AddFilter(g_grabberFilter, L"Sample Grabber");
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to add sample grabber filter to graph");
    }

    hr = g_grabberFilter->QueryInterface(DexterLib::IID_ISampleGrabber, reinterpret_cast<void**>(&g_sampleGrabber));
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to get sample grabber interface");
    }
}

void ConfigureSampleGrabberMediaType(Napi::Env env, const CaptureFormatSelection& selection, int fps) {
    DexterLib::_AMMediaType mt;
    ZeroMemory(&mt, sizeof(mt));
    mt.majortype = MEDIATYPE_Video;
    mt.subtype = selection.subtype;
    mt.formattype = FORMAT_VideoInfo;
    mt.cbFormat = sizeof(VIDEOINFOHEADER);
    mt.pbFormat = static_cast<unsigned char*>(CoTaskMemAlloc(sizeof(VIDEOINFOHEADER)));
    if (!mt.pbFormat) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to allocate media type format");
    }

    ZeroMemory(mt.pbFormat, sizeof(VIDEOINFOHEADER));
    auto* vih = reinterpret_cast<VIDEOINFOHEADER*>(mt.pbFormat);
    vih->AvgTimePerFrame = selection.avgTimePerFrame > 0 ? selection.avgTimePerFrame : 10000000LL / fps;
    vih->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    vih->bmiHeader.biWidth = selection.width;
    vih->bmiHeader.biHeight = selection.height;
    vih->bmiHeader.biPlanes = 1;

    if (selection.subtype == MEDIASUBTYPE_RGB32) {
        vih->bmiHeader.biBitCount = 32;
        vih->bmiHeader.biCompression = BI_RGB;
    } else if (selection.subtype == MEDIASUBTYPE_RGB24) {
        vih->bmiHeader.biBitCount = 24;
        vih->bmiHeader.biCompression = BI_RGB;
    } else {
        vih->bmiHeader.biBitCount = 16;
        vih->bmiHeader.biCompression = MAKEFOURCC('Y','U','Y','2');
    }

    HRESULT hr = g_sampleGrabber->SetMediaType(&mt);
    CoTaskMemFree(mt.pbFormat);
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set sample grabber media type");
    }

    g_captureFormatIsYuy2 = selection.isYuy2;
}

void ConfigureSampleGrabberOptions(Napi::Env env) {
    // Try FFmpeg-like settings
    HRESULT hr = g_sampleGrabber->SetBufferSamples(TRUE);
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set buffer samples");
    }

    hr = g_sampleGrabber->SetOneShot(FALSE);
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to disable one-shot mode");
    }
    
    // Add this - FFmpeg might use different callback methods
    std::cout << "[capture] SampleGrabber configured with buffer samples=TRUE, one-shot=FALSE" << std::endl;
}

void RegisterSampleCallback(Napi::Env env) {
    HRESULT hr = g_sampleGrabber->SetCallback(&g_callback, 0);
    if (FAILED(hr)) {
        std::cout << "[capture] SampleCB registration failed (hr=" << std::hex << hr << std::dec
                  << "), retrying BufferCB." << std::endl;
        hr = g_sampleGrabber->SetCallback(&g_callback, 1);
    }

    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set sample grabber callback");
    }
}

CaptureFormatSelection ConfigureStreamFormat(Napi::Env env, ICaptureGraphBuilder2* captureBuilder, int fps) {
    IAMStreamConfig* streamConfig = nullptr;
    HRESULT hr = captureBuilder->FindInterface(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video, g_videoFilter,
                                               IID_IAMStreamConfig, reinterpret_cast<void**>(&streamConfig));

    CaptureFormatSelection selection;
    if (SUCCEEDED(hr) && streamConfig) {
        selection = SelectCaptureFormat(streamConfig);
        streamConfig->Release();
    } else {
        std::cout << "[capture] IAMStreamConfig not available (hr=" << std::hex << hr << std::dec << ")." << std::endl;
    }

    ConfigureSampleGrabberMediaType(env, selection, fps);
    ConfigureSampleGrabberOptions(env);
    RegisterSampleCallback(env);
    return selection;
}

void ConfigureDirectPipeline(Napi::Env env, ICaptureGraphBuilder2* captureBuilder) {
    // FFmpeg approach: connect device pin directly to capture filter
    // First, get the device's capture pin
    IPin* devicePin = nullptr;
    IEnumPins* pinEnum = nullptr;
    
    HRESULT hr = g_videoFilter->EnumPins(&pinEnum);
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to enumerate device pins");
    }
    
    // Find the capture pin
    PIN_DIRECTION pinDir;
    while (pinEnum->Next(1, &devicePin, nullptr) == S_OK) {
        hr = devicePin->QueryDirection(&pinDir);
        if (SUCCEEDED(hr) && pinDir == PINDIR_OUTPUT) {
            PIN_INFO pinInfo;
            hr = devicePin->QueryPinInfo(&pinInfo);
            if (SUCCEEDED(hr)) {
                if (pinInfo.dir == PINDIR_OUTPUT) {
                    // This is an output pin, likely the capture pin
                    break;
                }
            }
        }
        devicePin->Release();
        devicePin = nullptr;
    }
    pinEnum->Release();
    
    if (!devicePin) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to find device capture pin");
    }
    
    // Use FFmpeg's exact RenderStream pattern
    hr = captureBuilder->RenderStream(NULL, NULL, (IUnknown*)devicePin, 
                                      NULL, g_grabberFilter);
    
    devicePin->Release();
    
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to connect FFmpeg-style pipeline");
    }
    
    std::cout << "[capture] FFmpeg-style pipeline connected (device pin -> grabber)." << std::endl;
}

void StartGraphOrThrow(Napi::Env env) {
    HRESULT hr = g_mediaControl->Run();
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to run graph");
    }

    std::cout << "[capture] Graph run request succeeded." << std::endl;

    OAFilterState graphState = State_Stopped;
    HRESULT stateHr = g_mediaControl->GetState(5000, &graphState);
    if (SUCCEEDED(stateHr)) {
        const char* stateStr = graphState == State_Running ? "Running"
                                : graphState == State_Paused ? "Paused" : "Stopped";
        std::cout << "[capture] Graph state after Run(): " << stateStr << std::endl;
    } else {
        std::cout << "[capture] GetState after Run failed (hr=" << std::hex << stateHr << std::dec << ")." << std::endl;
    }
}

void CacheConnectedMediaTypeOrThrow(Napi::Env env) {
    DexterLib::_AMMediaType connectedMt;
    HRESULT hr = g_sampleGrabber->GetConnectedMediaType(&connectedMt);
    if (SUCCEEDED(hr)) {
        std::cout << "[capture] Connected media type GUID: " << GuidToString(connectedMt.formattype)
                  << ", cbFormat=" << connectedMt.cbFormat << std::endl;
    } else {
        std::cout << "[capture] Failed to retrieve connected media type (hr=" << std::hex << hr << std::dec << ")" << std::endl;
    }

    g_hasMediaInfo = false;
    if (SUCCEEDED(hr) && connectedMt.pbFormat) {
        if (connectedMt.formattype == FORMAT_VideoInfo && connectedMt.cbFormat >= sizeof(VIDEOINFOHEADER)) {
            auto* pvi = reinterpret_cast<VIDEOINFOHEADER*>(connectedMt.pbFormat);
            if (pvi) {
                ConfigureBitmapInfo(pvi->bmiHeader, pvi->bmiHeader.biSizeImage);
            }
        } else if (connectedMt.formattype == FORMAT_VideoInfo2 && connectedMt.cbFormat >= sizeof(VIDEOINFOHEADER2)) {
            auto* pvi2 = reinterpret_cast<VIDEOINFOHEADER2*>(connectedMt.pbFormat);
            if (pvi2) {
                ConfigureBitmapInfo(pvi2->bmiHeader, pvi2->bmiHeader.biSizeImage);
            }
        }
        CoTaskMemFree(connectedMt.pbFormat);
        connectedMt.pbFormat = nullptr;
    }

    if (!g_hasMediaInfo) {
        std::cout << "[capture] No supported media info detected for GUID "
                  << GuidToString(connectedMt.formattype) << "." << std::endl;
        CleanupDirectShow();
        ThrowCaptureError(env, "Connected media type is not supported");
    }
}

} // namespace

// Sample grabber callback is implemented in capture_callback.cc

// Initialize DirectShow and start capture
void StartCapture(Napi::Env env, const std::string& deviceName, int fps) {
    InitializeFrameTiming(fps);
    ResetFrameMetadata();
    g_isCapturing = false;

    InitializeGraphBuilder(env);

    std::wstring deviceNameW = ToWide(deviceName);
    AddVideoDeviceFilter(env, deviceNameW);

    ICaptureGraphBuilder2* captureBuilder = CreateCaptureGraphBuilder(env);
    AddSampleGrabberFilter(env);
    ConfigureStreamFormat(env, captureBuilder, fps);
    ConfigureDirectPipeline(env, captureBuilder);
    captureBuilder->Release();

    StartGraphOrThrow(env);
    CacheConnectedMediaTypeOrThrow(env);

    g_isCapturing = true;
    std::cout << "[capture] Capture pipeline active." << std::endl;
}

// Stop capture
void StopCapture() {
    g_isCapturing = false;
    g_hasMediaInfo = false;
    
    if (g_callbackFunction) {
        g_callbackFunction.Release();
        g_callbackFunction = nullptr;
    }
    
    CleanupDirectShow();
}

// N-API functions
namespace Capture {
    // Start capture with device name, fps, and callback
    Napi::Value Start(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 3) {
            throw Napi::Error::New(env, "Expected 3 arguments: deviceName, fps, callback");
        }
        
        if (!info[0].IsString() || !info[1].IsNumber() || !info[2].IsFunction()) {
            throw Napi::Error::New(env, "Invalid argument types");
        }
        
        std::string deviceName = info[0].As<Napi::String>().Utf8Value();
        int fps = info[1].As<Napi::Number>().Int32Value();
        Napi::Function callback = info[2].As<Napi::Function>();
        
        if (fps <= 0) {
            throw Napi::Error::New(env, "FPS must be greater than 0");
        }
        
        // Create thread-safe function
        g_callbackFunction = Napi::ThreadSafeFunction::New(
            env,
            callback,
            "CaptureCallback",
            0,
            1,
            [](Napi::Env) {}
        );
        
        StartCapture(env, deviceName, fps);
        
        return env.Undefined();
    }
    
    // Stop capture
    Napi::Value Stop(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        StopCapture();
        
        return env.Undefined();
    }
    
    // Get latest frame
    Napi::Value GetFrame(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        std::lock_guard<std::mutex> lock(g_frameMutex);
        
        if (g_frameData.empty()) {
            return env.Null();
        }
        
        return Napi::Buffer<uint8_t>::Copy(env, g_frameData.data(), g_frameData.size());
    }
}

// Initialize module
Napi::Object InitCapture(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Capture::Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Capture::Stop));
    exports.Set(Napi::String::New(env, "getFrame"), Napi::Function::New(env, Capture::GetFrame));
    
    return exports;
}
