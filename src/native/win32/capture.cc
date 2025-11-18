#include <napi.h>
#include <windows.h>
#include <dshow.h>
#include <thread>
#include <atomic>
#include <chrono>
#include <vector>
#include <mutex>

// DirectShow GUIDs
DEFINE_GUID(CLSID_SampleGrabber, 0xC1F400A0, 0x3F08, 0x11d3, 0x9F, 0x0B, 0x00, 0x60, 0x08, 0x03, 0x9E, 0x37);
DEFINE_GUID(IID_ISampleGrabber, 0x6B652CCC, 0x7555, 0x11d3, 0x9B, 0x22, 0x00, 0x10, 0x5B, 0x98, 0x11, 0x49);
DEFINE_GUID(CLSID_VideoInputDeviceCategory, 0x860BB310, 0x5D01, 0x11d0, 0xB3, 0xF0, 0x00, 0xAA, 0x00, 0x37, 0x61, 0xC5);

interface ISampleGrabberCB : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE SampleCB(double sampleTime, IMediaSample *pSample) = 0;
    virtual HRESULT STDMETHODCALLTYPE BufferCB(double sampleTime, BYTE *pBuffer, long bufferLen) = 0;
};

static const GUID IID_ISampleGrabberCB = {0x0579394C,0x245A,0x11D3,{0xB8,0x73,0x00,0x10,0x5B,0xAE,0x62,0x2D}};

interface ISampleGrabber : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE SetMediaType(AM_MEDIA_TYPE *pType) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetBufferSamples(BOOL BufferThem) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetOneShot(BOOL OneShot) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetCallback(ISampleGrabberCB *pCallback, int whichMethod) = 0;
    virtual HRESULT STDMETHODCALLTYPE GetCurrentBuffer(long *pBufferSize, long *pBuffer) = 0;
};

// Global variables
static IGraphBuilder* g_graphBuilder = nullptr;
static IMediaControl* g_mediaControl = nullptr;
static IBaseFilter* g_videoFilter = nullptr;
static IBaseFilter* g_grabberFilter = nullptr;
static ISampleGrabber* g_sampleGrabber = nullptr;
static std::thread* g_captureThread = nullptr;
static std::atomic<bool> g_shouldStop(false);
static std::vector<uint8_t> g_latestFrame;
static std::mutex g_frameMutex;

class SampleGrabberCallback : public ISampleGrabberCB {
private:
    ULONG refCount = 1;

public:
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (riid == IID_IUnknown || riid == IID_ISampleGrabberCB) {
            *ppv = this;
            AddRef();
            return S_OK;
        }
        return E_NOINTERFACE;
    }

    ULONG STDMETHODCALLTYPE AddRef() override {
        return InterlockedIncrement(&refCount);
    }

    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = InterlockedDecrement(&refCount);
        if (count == 0) {
            delete this;
        }
        return count;
    }

    HRESULT STDMETHODCALLTYPE SampleCB(double sampleTime, IMediaSample* pSample) override {
        printf("DEBUG: SampleCB called!\n");
        
        long size = pSample->GetActualDataLength();
        if (size > 0) {
            BYTE* pBuffer = nullptr;
            if (SUCCEEDED(pSample->GetPointer(&pBuffer))) {
                std::lock_guard<std::mutex> lock(g_frameMutex);
                g_latestFrame.assign(pBuffer, pBuffer + size);
                printf("DEBUG: SampleCB captured %d bytes\n", size);
            }
        }
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE BufferCB(double sampleTime, BYTE* pBuffer, long bufferLen) override {
        printf("DEBUG: BufferCB called! bufferLen=%d\n", bufferLen);
        std::lock_guard<std::mutex> lock(g_frameMutex);
        g_latestFrame.assign(pBuffer, pBuffer + bufferLen);
        return S_OK;
    }
};

static SampleGrabberCallback* g_callback = nullptr;

void CleanupDirectShow() {
    printf("DEBUG: Cleanup called\n");
    
    if (g_captureThread) {
        g_shouldStop = true;
        if (g_captureThread->joinable()) {
            g_captureThread->join();
        }
        delete g_captureThread;
        g_captureThread = nullptr;
    }
    
    if (g_callback) {
        g_callback->Release();
        g_callback = nullptr;
    }
    
    if (g_sampleGrabber) {
        g_sampleGrabber->Release();
        g_sampleGrabber = nullptr;
    }
    
    if (g_grabberFilter) {
        g_grabberFilter->Release();
        g_grabberFilter = nullptr;
    }
    
    if (g_videoFilter) {
        g_videoFilter->Release();
        g_videoFilter = nullptr;
    }
    
    if (g_mediaControl) {
        g_mediaControl->Stop();
        g_mediaControl->Release();
        g_mediaControl = nullptr;
    }
    
    if (g_graphBuilder) {
        g_graphBuilder->Release();
        g_graphBuilder = nullptr;
    }
    
    g_shouldStop = false;
}

void CaptureThreadFunction(int intervalMs) {
    printf("DEBUG: Capture thread started with interval %d ms\n", intervalMs);
    
    // Start the DirectShow graph
    if (g_mediaControl) {
        HRESULT hr = g_mediaControl->Run();
        if (FAILED(hr)) {
            printf("DEBUG: Failed to run graph: 0x%08x\n", hr);
        } else {
            printf("DEBUG: Graph started successfully\n");
        }
    }
    
    while (!g_shouldStop) {
        // Process DirectShow events
        if (g_graphBuilder) {
            IMediaEvent* mediaEvent = nullptr;
            if (SUCCEEDED(g_graphBuilder->QueryInterface(IID_IMediaEvent, (void**)&mediaEvent))) {
                long evCode;
                LONG_PTR param1, param2;
                while (mediaEvent->GetEvent(&evCode, &param1, &param2, 0) == S_OK) {
                    printf("DEBUG: DirectShow event: 0x%08x\n", evCode);
                    mediaEvent->FreeEventParams(evCode, param1, param2);
                }
                mediaEvent->Release();
            }
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
    }
    
    printf("DEBUG: Capture thread stopped\n");
}

Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected device name and frame interval").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string deviceName = info[0].As<Napi::String>().Utf8Value();
    int intervalMs = info[1].As<Napi::Number>().Int32Value();
    
    printf("DEBUG: Initialize device='%s', interval=%d ms\n", deviceName.c_str(), intervalMs);
    
    CleanupDirectShow();
    
    HRESULT hr = CoInitialize(nullptr);
    if (FAILED(hr)) {
        throw std::runtime_error("Failed to initialize COM");
    }
    
    // Create graph builder
    hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER,
                          IID_IGraphBuilder, (void**)&g_graphBuilder);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to create graph builder");
    }
    
    // Get media control
    hr = g_graphBuilder->QueryInterface(IID_IMediaControl, (void**)&g_mediaControl);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to get media control");
    }
    
    // Create sample grabber
    hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER,
                          IID_IBaseFilter, (void**)&g_grabberFilter);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to create sample grabber");
    }
    
    hr = g_grabberFilter->QueryInterface(IID_ISampleGrabber, (void**)&g_sampleGrabber);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to get sample grabber interface");
    }
    
    // Configure Sample Grabber - simplest approach
    AM_MEDIA_TYPE mt;
    ZeroMemory(&mt, sizeof(mt));
    mt.majortype = MEDIATYPE_Video;
    mt.subtype = MEDIASUBTYPE_RGB24;
    mt.formattype = FORMAT_VideoInfo;
    
    hr = g_sampleGrabber->SetMediaType(&mt);
    if (FAILED(hr)) {
        throw std::runtime_error("Failed to set Sample Grabber media type");
    }
    
    printf("DEBUG: Creating callback\n");
    g_callback = new SampleGrabberCallback();
    
    // Set callback with 0 for buffer mode (not -1)
    hr = g_sampleGrabber->SetCallback(g_callback, 0);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to set Sample Grabber callback");
    }
    printf("DEBUG: Callback set successfully\n");
    
    // Find video device
    ICreateDevEnum* devEnum = nullptr;
    hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                          IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to create device enumerator");
    }
    
    IEnumMoniker* enumMoniker = nullptr;
    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
    if (FAILED(hr)) {
        devEnum->Release();
        CleanupDirectShow();
        throw std::runtime_error("Failed to create video device enumerator");
    }
    
    // Find matching device
    IMoniker* moniker = nullptr;
    bool deviceFound = false;
    
    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
        IPropertyBag* propBag = nullptr;
        hr = moniker->BindToStorage(0, 0, IID_IPropertyBag, (void**)&propBag);
        if (SUCCEEDED(hr)) {
            VARIANT var;
            VariantInit(&var);
            hr = propBag->Read(L"FriendlyName", &var, 0);
            if (SUCCEEDED(hr)) {
                std::wstring friendlyName(var.bstrVal);
                std::string deviceNameStr(friendlyName.begin(), friendlyName.end());
                
                printf("DEBUG: Found device: '%s'\n", deviceNameStr.c_str());
                
                if (deviceNameStr.find(deviceName) != std::string::npos) {
                    printf("DEBUG: Binding to video filter\n");
                    hr = moniker->BindToObject(0, 0, IID_IBaseFilter, (void**)&g_videoFilter);
                    if (SUCCEEDED(hr)) {
                        deviceFound = true;
                        printf("DEBUG: Device matched and bound!\n");
                    } else {
                        printf("DEBUG: Failed to bind video filter: 0x%08x\n", hr);
                    }
                }
            }
            VariantClear(&var);
            propBag->Release();
        }
        moniker->Release();
        
        if (deviceFound) break;
    }
    
    enumMoniker->Release();
    devEnum->Release();
    
    if (!deviceFound) {
        CleanupDirectShow();
        throw std::runtime_error("Video device not found");
    }
    
    printf("DEBUG: Adding video filter to graph\n");
    // Add video filter and connect
    hr = g_graphBuilder->AddFilter(g_videoFilter, L"Video Capture");
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to add video filter");
    }
    
    printf("DEBUG: Creating capture graph builder\n");
    ICaptureGraphBuilder2* captureBuilder = nullptr;
    hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                          IID_ICaptureGraphBuilder2, (void**)&captureBuilder);
    if (FAILED(hr)) {
        CleanupDirectShow();
        throw std::runtime_error("Failed to create capture graph builder");
    }
    
    printf("DEBUG: Setting filter graph\n");
    hr = captureBuilder->SetFiltergraph(g_graphBuilder);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        throw std::runtime_error("Failed to set filter graph");
    }
    
    printf("DEBUG: Adding sample grabber filter\n");
    hr = g_graphBuilder->AddFilter(g_grabberFilter, L"Sample Grabber");
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        throw std::runtime_error("Failed to add sample grabber filter");
    }
    
    printf("DEBUG: Rendering stream\n");
    // Direct connection without pin categories
    hr = captureBuilder->RenderStream(nullptr, &MEDIATYPE_Video,
                                      g_videoFilter, g_grabberFilter, nullptr);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        throw std::runtime_error("Failed to render capture stream");
    }
    
    printf("DEBUG: Graph built successfully\n");
    captureBuilder->Release();
    
    return env.Undefined();
}

Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_mediaControl) {
        throw std::runtime_error("Not initialized");
    }
    
    HRESULT hr = g_mediaControl->Run();
    if (FAILED(hr)) {
        throw std::runtime_error("Failed to start capture");
    }
    
    // Start capture thread with default interval
    g_shouldStop = false;
    g_captureThread = new std::thread(CaptureThreadFunction, 100);
    
    printf("DEBUG: Capture started\n");
    return env.Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    printf("DEBUG: Stop called\n");
    CleanupDirectShow();
    
    return env.Undefined();
}

Napi::Value GetFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::lock_guard<std::mutex> lock(g_frameMutex);
    
    printf("DEBUG: GetFrame called, captured frame size=%zu\n", g_latestFrame.size());
    
    if (g_latestFrame.empty()) {
        // Return empty buffer if no frame captured yet
        return Napi::Buffer<uint8_t>::New(env, nullptr, 0);
    }
    
    // Return the raw RGB24 data from DirectShow
    size_t frameSize = g_latestFrame.size();
    uint8_t* frameData = new uint8_t[frameSize];
    std::memcpy(frameData, g_latestFrame.data(), frameSize);
    
    printf("DEBUG: Returning raw RGB frame, size=%zu\n", frameSize);
    
    return Napi::Buffer<uint8_t>::New(env, frameData, frameSize, [](Napi::Env, uint8_t* data) {
        delete[] data;
    });
}

Napi::Object InitCapture(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "initialize"), Napi::Function::New(env, Initialize));
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Stop));
    exports.Set(Napi::String::New(env, "getFrame"), Napi::Function::New(env, GetFrame));
    return exports;
}
