#include "./headers/capture.h"
#include <iostream>
#include <vector>
#include <mutex>
#include <thread>
#include <memory>

// Global DirectShow objects
IGraphBuilder* g_graphBuilder = nullptr;
IMediaControl* g_mediaControl = nullptr;
IBaseFilter* g_videoFilter = nullptr;
DexterLib::ISampleGrabber* g_sampleGrabber = nullptr;
IBaseFilter* g_grabberFilter = nullptr;

// Frame data storage
std::vector<uint8_t> g_latestFrame;
std::mutex g_frameMutex;
bool g_shouldStop = false;
std::thread* g_captureThread = nullptr;

// Cleanup function
void CleanupDirectShow() {
    g_shouldStop = true;
    
    if (g_captureThread && g_captureThread->joinable()) {
        g_captureThread->join();
        delete g_captureThread;
        g_captureThread = nullptr;
    }
    
    if (g_mediaControl) {
        g_mediaControl->Stop();
        g_mediaControl->Release();
        g_mediaControl = nullptr;
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
    
    if (g_graphBuilder) {
        g_graphBuilder->Release();
        g_graphBuilder = nullptr;
    }
    
    CoUninitialize();
}

// Capture thread function
void CaptureThreadFunction(int intervalMs) {
    while (!g_shouldStop) {
        if (g_sampleGrabber) {
            long bufferSize = 0;
            HRESULT hr = g_sampleGrabber->GetCurrentBuffer(&bufferSize, nullptr);
            
            if (hr == S_OK && bufferSize > 0) {
                std::vector<uint8_t> buffer(bufferSize);
                hr = g_sampleGrabber->GetCurrentBuffer(&bufferSize, reinterpret_cast<long*>(buffer.data()));
                
                if (hr == S_OK) {
                    std::lock_guard<std::mutex> lock(g_frameMutex);
                    g_latestFrame = std::move(buffer);
                }
            }
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
    }
}

// Initialize capture device
Napi::Value Capture::Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: deviceName and intervalMs").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string deviceName = info[0].As<Napi::String>().Utf8Value();
    int intervalMs = info[1].As<Napi::Number>().Int32Value();
    
    CleanupDirectShow();
    
    HRESULT hr = CoInitialize(nullptr);
    if (FAILED(hr)) {
        Napi::Error::New(env, "Failed to initialize COM").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Create filter graph
    hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER,
                          IID_IGraphBuilder, (void**)&g_graphBuilder);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to create filter graph").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Get media control interface
    hr = g_graphBuilder->QueryInterface(IID_IMediaControl, (void**)&g_mediaControl);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to get media control interface").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Create sample grabber filter
    hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER,
                          IID_IBaseFilter, (void**)&g_grabberFilter);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to create sample grabber filter").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Get sample grabber interface
    hr = g_grabberFilter->QueryInterface(DexterLib::IID_ISampleGrabber, (void**)&g_sampleGrabber);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to get sample grabber interface").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Set media type for sample grabber (RGB24)
    DexterLib::_AMMediaType mt;
    ZeroMemory(&mt, sizeof(mt));
    mt.majortype = MEDIATYPE_Video;
    mt.subtype = MEDIASUBTYPE_RGB24;
    mt.formattype = FORMAT_VideoInfo;
    
    hr = g_sampleGrabber->SetMediaType(&mt);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to set sample grabber media type").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Enable sample buffering
    hr = g_sampleGrabber->SetBufferSamples(TRUE);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to enable sample buffering").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Find video capture device
    ICreateDevEnum* devEnum = nullptr;
    hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                          IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to create device enumerator").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    IEnumMoniker* enumMoniker = nullptr;
    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
    if (FAILED(hr)) {
        devEnum->Release();
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to create video device enumerator").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Enumerate devices and find matching one
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
                
                if (deviceNameStr.find(deviceName) != std::string::npos) {
                    // Found matching device, bind to video filter
                    hr = moniker->BindToObject(0, 0, IID_IBaseFilter, (void**)&g_videoFilter);
                    if (SUCCEEDED(hr)) {
                        deviceFound = true;
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
        Napi::Error::New(env, "Video device not found").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Add filters to graph
    hr = g_graphBuilder->AddFilter(g_videoFilter, L"Video Capture");
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to add video filter to graph").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    hr = g_graphBuilder->AddFilter(g_grabberFilter, L"Sample Grabber");
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to add sample grabber filter to graph").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Create capture graph builder
    ICaptureGraphBuilder2* captureBuilder = nullptr;
    hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                          IID_ICaptureGraphBuilder2, (void**)&captureBuilder);
    if (FAILED(hr)) {
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to create capture graph builder").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    hr = captureBuilder->SetFiltergraph(g_graphBuilder);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to set filter graph").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Connect the filters - render capture stream through sample grabber
    hr = captureBuilder->RenderStream(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video,
                                      g_videoFilter, g_grabberFilter, nullptr);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        Napi::Error::New(env, "Failed to render capture stream").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    captureBuilder->Release();
    
    return env.Undefined();
}

// Start capture
Napi::Value Capture::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_mediaControl) {
        Napi::Error::New(env, "Not initialized").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    HRESULT hr = g_mediaControl->Run();
    if (FAILED(hr)) {
        Napi::Error::New(env, "Failed to start capture").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Start capture thread
    g_shouldStop = false;
    g_captureThread = new std::thread(CaptureThreadFunction, 100); // Default 100ms interval
    
    return env.Undefined();
}

// Stop capture
Napi::Value Capture::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    CleanupDirectShow();
    
    return env.Undefined();
}

// Get latest frame
Napi::Value Capture::GetFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::lock_guard<std::mutex> lock(g_frameMutex);
    
    if (g_latestFrame.empty()) {
        // Return empty buffer if no frame captured yet
        return Napi::Buffer<uint8_t>::New(env, nullptr, 0);
    }
    
    // Create a copy of the frame data
    size_t frameSize = g_latestFrame.size();
    uint8_t* frameData = new uint8_t[frameSize];
    std::memcpy(frameData, g_latestFrame.data(), frameSize);
    
    return Napi::Buffer<uint8_t>::New(env, frameData, frameSize, [](Napi::Env, uint8_t* data) {
        delete[] data;
    });
}

// Initialize module
Napi::Object InitCapture(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "initialize"), Napi::Function::New(env, Capture::Initialize));
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Capture::Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Capture::Stop));
    exports.Set(Napi::String::New(env, "getFrame"), Napi::Function::New(env, Capture::GetFrame));
    
    return exports;
}
