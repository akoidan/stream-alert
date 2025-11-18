#include "./headers/capture.h"
#include <cstring>
#include <memory>
#include <dshow.h>
#include <vector>
#include <locale>
#include <codecvt>

// Define Sample Grabber GUIDs and interface
DEFINE_GUID(CLSID_SampleGrabber, 0xC1F400A0, 0x3F08, 0x11d3, 0x9F, 0x0B, 0x00, 0x60, 0x08, 0x03, 0x9E, 0x37);
DEFINE_GUID(IID_ISampleGrabber, 0x6B652CCC, 0x7555, 0x11d3, 0x9B, 0x22, 0x00, 0x10, 0x5B, 0x98, 0x11, 0x49);
DEFINE_GUID(CLSID_VideoInputDeviceCategory, 0x860BB310, 0x5D01, 0x11d0, 0xB3, 0xF0, 0x00, 0xAA, 0x00, 0x37, 0x61, 0xC5);

interface ISampleGrabberCB : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE SampleCB(double sampleTime, IMediaSample *pSample) = 0;
    virtual HRESULT STDMETHODCALLTYPE BufferCB(double sampleTime, BYTE *pBuffer, long bufferLen) = 0;
};

// IID for ISampleGrabberCB
static const GUID IID_ISampleGrabberCB = {0x0579394C,0x245A,0x11D3,{0xB8,0x73,0x00,0x10,0x5B,0xAE,0x62,0x2D}};

interface ISampleGrabber : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE SetMediaType(AM_MEDIA_TYPE *pType) = 0;
    virtual HRESULT STDMETHODCALLTYPE GetConnectedMediaType(AM_MEDIA_TYPE *pType) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetBufferSamples(BOOL BufferThem) = 0;
    virtual HRESULT STDMETHODCALLTYPE GetCurrentBuffer(long *pBufferSize, long *pBuffer) = 0;
    virtual HRESULT STDMETHODCALLTYPE GetCurrentSample(IMediaSample **ppSample) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetOneShot(BOOL OneShot) = 0;
    virtual HRESULT STDMETHODCALLTYPE SetCallback(ISampleGrabberCB *pCallback) = 0;
};

namespace Capture {
    
    class SampleGrabberCallback : public ISampleGrabberCB {
    private:
        std::vector<uint8_t> latestFrame;
        CRITICAL_SECTION frameLock;
        ULONG refCount;

    public:
        SampleGrabberCallback() : refCount(1) {
            InitializeCriticalSection(&frameLock);
        }

        ~SampleGrabberCallback() {
            DeleteCriticalSection(&frameLock);
        }

        // IUnknown methods
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

        // ISampleGrabberCB methods
        HRESULT STDMETHODCALLTYPE SampleCB(double sampleTime, IMediaSample* pSample) override {
            return S_OK;
        }

        HRESULT STDMETHODCALLTYPE BufferCB(double sampleTime, BYTE* pBuffer, long bufferLen) override {
            EnterCriticalSection(&frameLock);
            latestFrame.assign(pBuffer, pBuffer + bufferLen);
            LeaveCriticalSection(&frameLock);
            return S_OK;
        }

        std::vector<uint8_t> GetLatestFrame() {
            EnterCriticalSection(&frameLock);
            std::vector<uint8_t> frame = latestFrame;
            LeaveCriticalSection(&frameLock);
            return frame;
        }
    };

    class DirectShowCapture {
    private:
        IGraphBuilder* graphBuilder;
        ICaptureGraphBuilder2* captureGraphBuilder;
        IMediaControl* mediaControl;
        IBaseFilter* videoInputFilter;
        IBaseFilter* sampleGrabberFilter;
        ISampleGrabber* sampleGrabber;
        IMediaEvent* mediaEvent;
        AM_MEDIA_TYPE mediaType;
        SampleGrabberCallback* callback;
        bool isCapturing;
        CRITICAL_SECTION frameLock;
        std::vector<uint8_t> latestFrame;
        
    public:
        DirectShowCapture() : graphBuilder(nullptr), captureGraphBuilder(nullptr), 
            mediaControl(nullptr), videoInputFilter(nullptr), sampleGrabberFilter(nullptr),
            sampleGrabber(nullptr), mediaEvent(nullptr), callback(nullptr), isCapturing(false) {
            InitializeCriticalSection(&frameLock);
            ZeroMemory(&mediaType, sizeof(mediaType));
        }
        
        ~DirectShowCapture() {
            Stop();
            Cleanup();
            DeleteCriticalSection(&frameLock);
        }
        
        void Initialize(const char* deviceName, int frameRate) {
            HRESULT hr = CoInitialize(nullptr);
            if (FAILED(hr)) {
                throw std::runtime_error("Failed to initialize COM");
            }
            
            // Create graph builder
            hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER,
                                IID_IGraphBuilder, (void**)&graphBuilder);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to create graph builder");
            }
            
            // Create capture graph builder
            hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                                IID_ICaptureGraphBuilder2, (void**)&captureGraphBuilder);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to create capture graph builder");
            }
            
            // Set graph builder in capture graph builder
            hr = captureGraphBuilder->SetFiltergraph(graphBuilder);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to set filter graph");
            }
            
            // Get media control interface
            hr = graphBuilder->QueryInterface(IID_IMediaControl, (void**)&mediaControl);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to get media control interface");
            }
            
            // Get media event interface
            hr = graphBuilder->QueryInterface(IID_IMediaEvent, (void**)&mediaEvent);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to get media event interface");
            }
            
            // Create sample grabber filter
            hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER,
                                IID_IBaseFilter, (void**)&sampleGrabberFilter);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to create sample grabber filter");
            }
            
            // Get sample grabber interface
            hr = sampleGrabberFilter->QueryInterface(IID_ISampleGrabber, (void**)&sampleGrabber);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to get sample grabber interface");
            }
            
            // Configure Sample Grabber
            AM_MEDIA_TYPE mt;
            ZeroMemory(&mt, sizeof(mt));
            mt.majortype = MEDIATYPE_Video;
            mt.subtype = MEDIASUBTYPE_RGB24;
            mt.formattype = FORMAT_VideoInfo;
            
            // Allocate VIDEOINFOHEADER
            mt.pbFormat = (BYTE*)CoTaskMemAlloc(sizeof(VIDEOINFOHEADER));
            if (!mt.pbFormat) {
                Cleanup();
                throw std::runtime_error("Failed to allocate VIDEOINFOHEADER");
            }
            ZeroMemory(mt.pbFormat, sizeof(VIDEOINFOHEADER));
            
            VIDEOINFOHEADER* pvi = (VIDEOINFOHEADER*)mt.pbFormat;
            pvi->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
            pvi->bmiHeader.biWidth = 640;
            pvi->bmiHeader.biHeight = 480;
            pvi->bmiHeader.biPlanes = 1;
            pvi->bmiHeader.biBitCount = 24;
            pvi->bmiHeader.biCompression = BI_RGB;
            pvi->bmiHeader.biSizeImage = (640 * 480 * 3);
            mt.lSampleSize = pvi->bmiHeader.biSizeImage;
            
            printf("DEBUG: Setting media type with VIDEOINFOHEADER\n");
            hr = sampleGrabber->SetMediaType(&mt);
            printf("DEBUG: SetMediaType result: 0x%X\n", hr);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to set sample grabber media type");
            }
            
            hr = sampleGrabber->SetBufferSamples(TRUE);
            printf("DEBUG: SetBufferSamples result: 0x%X\n", hr);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to enable sample buffering");
            }
            
            hr = sampleGrabber->SetOneShot(FALSE);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to disable one-shot mode");
            }
            
            // Create and set callback
            callback = new SampleGrabberCallback();
            hr = sampleGrabber->SetCallback(callback);
            if (FAILED(hr)) {
                printf("DEBUG: Failed to set callback: 0x%X\n", hr);
                Cleanup();
                throw std::runtime_error("Failed to set sample grabber callback");
            }
            printf("DEBUG: Callback set successfully\n");
            
            // Add sample grabber to graph
            hr = graphBuilder->AddFilter(sampleGrabberFilter, L"Sample Grabber");
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to add sample grabber to graph");
            }
            
            // Find video capture device
            ICreateDevEnum* devEnum = nullptr;
            hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                IID_ICreateDevEnum, (void**)&devEnum);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to create device enumerator");
            }
            
            IEnumMoniker* enumMoniker = nullptr;
            hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
            if (FAILED(hr)) {
                devEnum->Release();
                Cleanup();
                throw std::runtime_error("Failed to create video device enumerator");
            }
            
            IMoniker* moniker = nullptr;
            bool deviceFound = false;
            int deviceCount = 0;
            
            printf("DEBUG: Searching for video devices matching '%s'\n", deviceName);
            
            while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
                deviceCount++;
                IPropertyBag* propBag = nullptr;
                hr = moniker->BindToStorage(0, 0, IID_IPropertyBag, (void**)&propBag);
                if (SUCCEEDED(hr)) {
                    VARIANT var;
                    VariantInit(&var);
                    hr = propBag->Read(L"FriendlyName", &var, 0);
                    if (SUCCEEDED(hr)) {
                        std::wstring friendlyName(var.bstrVal);
                        std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
                        std::string deviceNameStr = converter.to_bytes(friendlyName);
                        
                        printf("DEBUG: Found device %d: '%s'\n", deviceCount, deviceNameStr.c_str());
                        
                        if (deviceNameStr.find(deviceName) != std::string::npos) {
                            printf("DEBUG: Device matches! Creating filter...\n");
                            hr = moniker->BindToObject(0, 0, IID_IBaseFilter, (void**)&videoInputFilter);
                            if (SUCCEEDED(hr)) {
                                deviceFound = true;
                                printf("DEBUG: Successfully created video input filter\n");
                            }
                        }
                    }
                    VariantClear(&var);
                    propBag->Release();
                }
                moniker->Release();
                
                if (deviceFound) break;
            }
            
            printf("DEBUG: Device search complete. Found %d devices, deviceFound=%d\n", deviceCount, deviceFound);
            
            enumMoniker->Release();
            devEnum->Release();
            
            if (!deviceFound || !videoInputFilter) {
                Cleanup();
                throw std::runtime_error("Video capture device not found");
            }
            
            // Add video input filter to graph
            hr = graphBuilder->AddFilter(videoInputFilter, L"Video Capture");
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to add video input filter to graph");
            }
            
            // Connect filters - video input to sample grabber
            hr = captureGraphBuilder->RenderStream(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video,
                                                  videoInputFilter, nullptr, sampleGrabberFilter);
            if (FAILED(hr)) {
                Cleanup();
                throw std::runtime_error("Failed to connect video input to sample grabber");
            }
        }
        
        void Start() {
            if (!mediaControl) {
                throw std::runtime_error("Media control not initialized");
            }
            
            HRESULT hr = mediaControl->Run();
            if (FAILED(hr)) {
                throw std::runtime_error("Failed to start media control");
            }
            
            isCapturing = true;
        }
        
        void Stop() {
            if (!mediaControl) {
                throw std::runtime_error("Media control not initialized");
            }
            
            HRESULT hr = mediaControl->Stop();
            if (FAILED(hr)) {
                throw std::runtime_error("Failed to stop media control");
            }
            
            isCapturing = false;
        }
        
        void Cleanup() {
            printf("DEBUG: Cleanup called\n");
            
            if (callback) {
                callback->Release();
                callback = nullptr;
            }
            
            if (mediaType.pbFormat) {
                CoTaskMemFree(mediaType.pbFormat);
                ZeroMemory(&mediaType, sizeof(mediaType));
            }
            
            if (mediaEvent) {
                mediaEvent->Release();
                mediaEvent = nullptr;
            }
            
            if (sampleGrabber) {
                sampleGrabber->Release();
                sampleGrabber = nullptr;
            }
            
            if (sampleGrabberFilter) {
                sampleGrabberFilter->Release();
                sampleGrabberFilter = nullptr;
            }
            
            if (videoInputFilter) {
                videoInputFilter->Release();
                videoInputFilter = nullptr;
            }
            
            if (mediaControl) {
                mediaControl->Release();
                mediaControl = nullptr;
            }
            
            if (captureGraphBuilder) {
                captureGraphBuilder->Release();
                captureGraphBuilder = nullptr;
            }
            
            if (graphBuilder) {
                graphBuilder->Release();
                graphBuilder = nullptr;
            }
        }
        
        Napi::Buffer<uint8_t> GetFrame(Napi::Env env) {
            printf("DEBUG: GetFrame internal - isCapturing=%d, callback=%p\n", isCapturing, callback);
            
            if (!isCapturing || !callback) {
                printf("DEBUG: Not capturing or callback is null, returning empty buffer\n");
                return Napi::Buffer<uint8_t>::New(env, nullptr, 0);
            }
            
            std::vector<uint8_t> frame = callback->GetLatestFrame();
            printf("DEBUG: Got frame from callback, size=%zu\n", frame.size());
            
            if (frame.empty()) {
                printf("DEBUG: Frame is empty, returning empty buffer\n");
                return Napi::Buffer<uint8_t>::New(env, nullptr, 0);
            }
            
            // Create a simple JPEG header + frame data
            const char jpegHeader[] = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00";
            const size_t headerSize = sizeof(jpegHeader) - 1;
            
            size_t totalSize = headerSize + frame.size();
            printf("DEBUG: Creating JPEG buffer with total size=%zu\n", totalSize);
            
            uint8_t* jpegData = new uint8_t[totalSize];
            
            // Copy JPEG header
            std::memcpy(jpegData, jpegHeader, headerSize);
            // Copy frame data
            std::memcpy(jpegData + headerSize, frame.data(), frame.size());
            
            return Napi::Buffer<uint8_t>::New(env, jpegData, totalSize, [](Napi::Env, uint8_t* data) {
                delete[] data;
            });
        }
    };
    
    static std::unique_ptr<DirectShowCapture> g_capture;
    
    Napi::Value Initialize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected device name and frame rate arguments").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        std::string deviceName = info[0].As<Napi::String>().Utf8Value();
        int32_t frameRate = info[1].As<Napi::Number>().Int32Value();
        
        printf("DEBUG: Initialize called with deviceName='%s', frameRate=%d\n", deviceName.c_str(), frameRate);
        
        if (g_capture) {
            g_capture.reset();
        }
        
        g_capture = std::make_unique<DirectShowCapture>();
        try {
            g_capture->Initialize(deviceName.c_str(), frameRate);
            printf("DEBUG: Initialize succeeded\n");
        } catch (const std::exception& e) {
            printf("DEBUG: Initialize failed: %s\n", e.what());
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        }
        
        return env.Undefined();
    }
    
    Napi::Value Start(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (!g_capture) {
            Napi::Error::New(env, "Capture not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        try {
            printf("DEBUG: Starting capture...\n");
            g_capture->Start();
            printf("DEBUG: Start succeeded\n");
        } catch (const std::exception& e) {
            printf("DEBUG: Start failed: %s\n", e.what());
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        }
        
        return env.Undefined();
    }
    
    Napi::Value Stop(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (!g_capture) {
            Napi::Error::New(env, "Capture not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        try {
            g_capture->Stop();
        } catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        }
        
        return env.Undefined();
    }
    
    Napi::Value GetFrame(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (!g_capture) {
            printf("DEBUG: GetFrame called but capture not initialized\n");
            Napi::Error::New(env, "Capture not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        printf("DEBUG: GetFrame called\n");
        return g_capture->GetFrame(env);
    }
    
    Napi::Object Init(Napi::Env env, Napi::Object exports) {
        exports.Set(Napi::String::New(env, "initialize"), Napi::Function::New(env, Initialize));
        exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Start));
        exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Stop));
        exports.Set(Napi::String::New(env, "getFrame"), Napi::Function::New(env, GetFrame));
        
        return exports;
    }
}
