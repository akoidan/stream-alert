#include "headers/capture.h"
#include <iostream>
#include <memory>
#include <chrono>
#include <stdexcept>
#include <cstring>
#include <mutex>
#include <vector>
#include <dshow.h>
#include <napi.h>

#pragma comment(lib, "strmiids.lib")

// Global DirectShow objects
IGraphBuilder* g_graphBuilder = nullptr;
IMediaControl* g_mediaControl = nullptr;
IBaseFilter* g_videoFilter = nullptr;
DexterLib::ISampleGrabber* g_sampleGrabber = nullptr;
IBaseFilter* g_grabberFilter = nullptr;

// Frame data
std::vector<uint8_t> g_frameData;
std::mutex g_frameMutex;
bool g_isCapturing = false;

// Callback reference
Napi::ThreadSafeFunction g_callbackFunction;

namespace {
    void ReleaseCallbackFunction() {
        if (g_callbackFunction) {
            g_callbackFunction.Release();
            g_callbackFunction = nullptr;
        }
    }

    [[noreturn]] void ThrowCaptureError(Napi::Env env, const char* message) {
        ReleaseCallbackFunction();
        throw Napi::Error::New(env, message);
    }
}

// Frame dimensions
int g_frameWidth = 0;
int g_frameHeight = 0;

BITMAPINFOHEADER g_bitmapInfoHeader = {};
bool g_hasMediaInfo = false;

// Frame rate control
std::chrono::steady_clock::time_point g_lastCallbackTime;
int g_targetFps = 30;

// Cleanup DirectShow resources
void CleanupDirectShow() {
    if (g_mediaControl) {
        g_mediaControl->Stop();
        g_mediaControl->Release();
        g_mediaControl = nullptr;
    }
    
    if (g_graphBuilder) {
        g_graphBuilder->Release();
        g_graphBuilder = nullptr;
    }
    
    if (g_videoFilter) {
        g_videoFilter->Release();
        g_videoFilter = nullptr;
    }
    
    if (g_sampleGrabber) {
        g_sampleGrabber->Release();
        g_sampleGrabber = nullptr;
    }
    
    if (g_grabberFilter) {
        g_grabberFilter->Release();
        g_grabberFilter = nullptr;
    }
    
    CoUninitialize();
}

// Sample grabber callback
class SampleGrabberCallback : public DexterLib::ISampleGrabberCB {
public:
    STDMETHODIMP_(ULONG) AddRef() { return 1; }
    STDMETHODIMP_(ULONG) Release() { return 1; }
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
        if (riid == IID_IUnknown || riid == DexterLib::IID_ISampleGrabberCB) {
            *ppv = static_cast<DexterLib::ISampleGrabberCB*>(this);
            AddRef();
            return S_OK;
        }
        return E_NOINTERFACE;
    }
    
    STDMETHODIMP SampleCB(double /*SampleTime*/, DexterLib::IMediaSample* /*pSample*/) override {
        return S_OK;
    }
    
    STDMETHODIMP BufferCB(double sampleTime, BYTE* pBuffer, long bufferLen) override {
        if (!pBuffer || !g_isCapturing) {
            return S_OK;
        }
        
        long dataSize = bufferLen;
        if (dataSize > 0 && g_hasMediaInfo) {
            BITMAPFILEHEADER fileHeader{};
            fileHeader.bfType = 'MB';
            fileHeader.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
            fileHeader.bfSize = fileHeader.bfOffBits + dataSize;

            BITMAPINFOHEADER infoHeader = g_bitmapInfoHeader;
            infoHeader.biSizeImage = dataSize;

            auto bmpData = std::vector<uint8_t>(fileHeader.bfSize);
            std::memcpy(bmpData.data(), &fileHeader, sizeof(BITMAPFILEHEADER));
            std::memcpy(bmpData.data() + sizeof(BITMAPFILEHEADER), &infoHeader, sizeof(BITMAPINFOHEADER));
            std::memcpy(bmpData.data() + fileHeader.bfOffBits, pBuffer, dataSize);

            std::lock_guard<std::mutex> lock(g_frameMutex);
            g_frameData = bmpData;

            // Frame rate control - only callback at target FPS
            auto now = std::chrono::steady_clock::now();
            auto interval = std::chrono::milliseconds(1000 / g_targetFps);

            if (now - g_lastCallbackTime >= interval) {
                g_lastCallbackTime = now;

                if (g_callbackFunction) {
                    auto frameCopy = std::make_shared<std::vector<uint8_t>>(g_frameData);
                    auto frameWidth = g_frameWidth > 0 ? g_frameWidth : infoHeader.biWidth;
                    auto frameHeight = g_frameHeight > 0 ? g_frameHeight : infoHeader.biHeight;

                    g_callbackFunction.NonBlockingCall([frameCopy, frameWidth, frameHeight](Napi::Env env, Napi::Function jsCallback) {
                        Napi::Object frameInfo = Napi::Object::New(env);
                        frameInfo.Set("width", Napi::Number::New(env, frameWidth));
                        frameInfo.Set("height", Napi::Number::New(env, frameHeight));
                        frameInfo.Set("dataSize", Napi::Number::New(env, frameCopy->size()));

                        Napi::Buffer<uint8_t> frameBuffer = Napi::Buffer<uint8_t>::Copy(env, frameCopy->data(), frameCopy->size());
                        frameInfo.Set("data", frameBuffer);

                        jsCallback.Call({frameInfo});
                    });
                }
            }
        }

        return S_OK;
    }
};

SampleGrabberCallback g_callback;

// Find video capture device
IBaseFilter* FindCaptureDevice(const std::wstring& deviceName) {
    ICreateDevEnum* devEnum = nullptr;
    IEnumMoniker* enumMoniker = nullptr;
    IMoniker* moniker = nullptr;
    
    // Create system device enumerator
    HRESULT hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) {
        return nullptr;
    }
    
    // Create enumerator for video capture devices
    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
    if (FAILED(hr) || !enumMoniker) {
        devEnum->Release();
        return nullptr;
    }
    
    // Enumerate devices
    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
        IPropertyBag* propBag = nullptr;
        hr = moniker->BindToStorage(0, 0, IID_IPropertyBag, (void**)&propBag);
        if (SUCCEEDED(hr)) {
            VARIANT var;
            VariantInit(&var);
            hr = propBag->Read(L"FriendlyName", &var, 0);
            if (SUCCEEDED(hr) && var.vt == VT_BSTR) {
                std::wstring friendlyName = var.bstrVal;
                
                // Check if device name matches (case insensitive)
                if (friendlyName.find(deviceName) != std::wstring::npos) {
                    IBaseFilter* filter = nullptr;
                    hr = moniker->BindToObject(0, 0, IID_IBaseFilter, (void**)&filter);
                    if (SUCCEEDED(hr)) {
                        VariantClear(&var);
                        propBag->Release();
                        moniker->Release();
                        enumMoniker->Release();
                        devEnum->Release();
                        return filter;
                    }
                }
                VariantClear(&var);
            }
            propBag->Release();
        }
        moniker->Release();
    }
    
    enumMoniker->Release();
    devEnum->Release();
    return nullptr;
}

// Initialize DirectShow and start capture
void StartCapture(Napi::Env env, const std::string& deviceName, int fps) {
    HRESULT hr;
    
    // Set target FPS
    g_targetFps = fps;
    g_lastCallbackTime = std::chrono::steady_clock::now();
    
    // Initialize COM if not already initialized
    hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (hr != S_OK && hr != S_FALSE && hr != RPC_E_CHANGED_MODE) {
        ThrowCaptureError(env, "Failed to initialize COM");
    }
    
    // Convert device name to wstring
    std::wstring deviceNameW(deviceName.begin(), deviceName.end());
    
    // Create graph builder
    hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER, 
                         IID_IGraphBuilder, (void**)&g_graphBuilder);
    if (FAILED(hr)) {
        ThrowCaptureError(env, "Failed to create graph builder");
    }
    
    // Get media control interface
    hr = g_graphBuilder->QueryInterface(IID_IMediaControl, (void**)&g_mediaControl);
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to get media control");
    }
    
    // Create capture graph builder
    ICaptureGraphBuilder2* captureBuilder = nullptr;
    hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                         IID_ICaptureGraphBuilder2, (void**)&captureBuilder);
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
    
    // Find video capture device
    g_videoFilter = FindCaptureDevice(deviceNameW);
    if (!g_videoFilter) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to find video capture device");
    }
    
    // Add video filter to graph
    hr = g_graphBuilder->AddFilter(g_videoFilter, L"Video Capture");
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to add video filter to graph");
    }
    
    // Create sample grabber filter
    hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER, 
                         IID_IBaseFilter, (void**)&g_grabberFilter);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to create sample grabber filter");
    }
    
    // Add sample grabber filter to graph
    hr = g_graphBuilder->AddFilter(g_grabberFilter, L"Sample Grabber");
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to add sample grabber filter to graph");
    }
    
    // Get sample grabber interface
    hr = g_grabberFilter->QueryInterface(DexterLib::IID_ISampleGrabber, (void**)&g_sampleGrabber);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to get sample grabber interface");
    }
    
    // Set media type for sample grabber (YUY2 for better performance)
    DexterLib::_AMMediaType mt;
    ZeroMemory(&mt, sizeof(mt));
    mt.majortype = MEDIATYPE_Video;
    mt.subtype = MEDIASUBTYPE_RGB24;
    mt.formattype = FORMAT_VideoInfo;
    mt.pbFormat = (unsigned char*)CoTaskMemAlloc(sizeof(VIDEOINFOHEADER));
    if (!mt.pbFormat) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to allocate media type format");
    }
    ZeroMemory(mt.pbFormat, sizeof(VIDEOINFOHEADER));
    
    // Set frame rate in VIDEOINFOHEADER
    VIDEOINFOHEADER* pvi = (VIDEOINFOHEADER*)mt.pbFormat;
    pvi->AvgTimePerFrame = 10000000LL / fps; // Convert FPS to 100ns units
    pvi->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    pvi->bmiHeader.biWidth = 0;  // Let camera decide
    pvi->bmiHeader.biHeight = 0; // Let camera decide
    pvi->bmiHeader.biPlanes = 1;
    pvi->bmiHeader.biBitCount = 24;
    pvi->bmiHeader.biCompression = BI_RGB;
    mt.cbFormat = sizeof(VIDEOINFOHEADER);
    
    hr = g_sampleGrabber->SetMediaType(&mt);
    // Free the format block
    if (mt.pbFormat) {
        CoTaskMemFree(mt.pbFormat);
    }
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set sample grabber media type");
    }
    
    // Set buffer size
    hr = g_sampleGrabber->SetBufferSamples(TRUE);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set buffer samples");
    }
    
    // Set callback
    hr = g_sampleGrabber->SetCallback(&g_callback, 1);  // Use BufferCB
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set sample grabber callback");
    }
    
    // Create Null Renderer filter to prevent window from appearing
    IBaseFilter* nullRenderer = nullptr;
    hr = CoCreateInstance(CLSID_NullRenderer, nullptr, CLSCTX_INPROC_SERVER,
                         IID_IBaseFilter, (void**)&nullRenderer);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to create null renderer");
    }
    
    // Add null renderer to graph
    hr = g_graphBuilder->AddFilter(nullRenderer, L"Null Renderer");
    if (FAILED(hr)) {
        nullRenderer->Release();
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to add null renderer to graph");
    }
    
    // Connect the filters - capture -> sample grabber -> null renderer (no window)
    hr = captureBuilder->RenderStream(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video,
                                      g_videoFilter, g_grabberFilter, nullRenderer);
    if (FAILED(hr)) {
        nullRenderer->Release();
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to connect capture stream");
    }
    
    // Release null renderer (graph maintains reference)
    nullRenderer->Release();
    
    // Release capture graph builder
    captureBuilder->Release();
    
    // Start the graph
    hr = g_mediaControl->Run();
    if (FAILED(hr)) {
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to run graph");
    }
    
    // Get the actual media type to extract frame dimensions
    DexterLib::_AMMediaType connectedMt;
    hr = g_sampleGrabber->GetConnectedMediaType(&connectedMt);
    if (SUCCEEDED(hr) && connectedMt.formattype == FORMAT_VideoInfo && connectedMt.pbFormat &&
        connectedMt.cbFormat >= sizeof(VIDEOINFOHEADER)) {
        VIDEOINFOHEADER* pvi = (VIDEOINFOHEADER*)connectedMt.pbFormat;
        if (pvi) {
            g_frameWidth = pvi->bmiHeader.biWidth;
            g_frameHeight = pvi->bmiHeader.biHeight;

            g_bitmapInfoHeader = {};
            g_bitmapInfoHeader.biSize = sizeof(BITMAPINFOHEADER);
            g_bitmapInfoHeader.biWidth = g_frameWidth;
            g_bitmapInfoHeader.biHeight = g_frameHeight;
            g_bitmapInfoHeader.biPlanes = 1;
            g_bitmapInfoHeader.biBitCount = 24;
            g_bitmapInfoHeader.biCompression = BI_RGB;
            g_bitmapInfoHeader.biSizeImage = pvi->bmiHeader.biSizeImage;
            g_hasMediaInfo = true;
        }
        if (connectedMt.pbFormat) {
            CoTaskMemFree(connectedMt.pbFormat);
        }
    }

    g_isCapturing = g_hasMediaInfo;
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
