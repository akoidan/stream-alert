#include <node_api.h>
#include <cstring>
#include <memory>
#include <vector>
#include <windows.h>
#include <dshow.h>
#include <strmiids.h>
#include <qedit.h>
#include "dshow_device.h"
#include "frame_buffer.h"

#pragma comment(lib, "strmiids.lib")
#pragma comment(lib, "quartz.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

class DirectShowCapture {
private:
    IGraphBuilder* graph;
    ICaptureGraphBuilder2* captureGraph;
    IBaseFilter* captureFilter;
    ISampleGrabber* sampleGrabber;
    IMediaControl* mediaControl;
    IMediaEvent* mediaEvent;
    FrameBuffer frameBuffer;
    bool isRunning;
    
public:
    DirectShowCapture() : 
        graph(nullptr), 
        captureGraph(nullptr), 
        captureFilter(nullptr), 
        sampleGrabber(nullptr), 
        mediaControl(nullptr),
        mediaEvent(nullptr),
        isRunning(false) {}
    
    ~DirectShowCapture() {
        Stop();
    }
    
    bool Initialize(const char* deviceName, int frameRate) {
        HRESULT hr;
        
        // Create Filter Graph
        hr = CoCreateInstance(CLSID_FilterGraph, nullptr, CLSCTX_INPROC_SERVER, 
                             IID_IGraphBuilder, (void**)&graph);
        if (FAILED(hr)) return false;
        
        // Create Capture Graph Builder
        hr = CoCreateInstance(CLSID_CaptureGraphBuilder2, nullptr, CLSCTX_INPROC_SERVER,
                             IID_ICaptureGraphBuilder2, (void**)&captureGraph);
        if (FAILED(hr)) return false;
        
        // Set filter graph to capture graph builder
        hr = captureGraph->SetFiltergraph(graph);
        if (FAILED(hr)) return false;
        
        // Get Media Control interface
        hr = graph->QueryInterface(IID_IMediaControl, (void**)&mediaControl);
        if (FAILED(hr)) return false;
        
        // Get Media Event interface
        hr = graph->QueryInterface(IID_IMediaEvent, (void**)&mediaEvent);
        if (FAILED(hr)) return false;
        
        // Find capture device
        hr = FindCaptureDevice(deviceName, &captureFilter);
        if (FAILED(hr)) return false;
        
        // Add capture filter to graph
        hr = graph->AddFilter(captureFilter, L"Capture Filter");
        if (FAILED(hr)) return false;
        
        // Create Sample Grabber
        hr = CoCreateInstance(CLSID_SampleGrabber, nullptr, CLSCTX_INPROC_SERVER,
                             IID_ISampleGrabber, (void**)&sampleGrabber);
        if (FAILED(hr)) return false;
        
        // Configure Sample Grabber
        AM_MEDIA_TYPE mt;
        ZeroMemory(&mt, sizeof(mt));
        mt.majortype = MEDIATYPE_Video;
        mt.subtype = MEDIASUBTYPE_MJPG;
        hr = sampleGrabber->SetMediaType(&mt);
        if (FAILED(hr)) return false;
        
        // Set sample grabber callback mode
        hr = sampleGrabber->SetBufferSamples(TRUE);
        if (FAILED(hr)) return false;
        
        // Get IBaseFilter interface from sample grabber
        IBaseFilter* grabberFilter;
        hr = sampleGrabber->QueryInterface(IID_IBaseFilter, (void**)&grabberFilter);
        if (FAILED(hr)) return false;
        
        // Add sample grabber to graph
        hr = graph->AddFilter(grabberFilter, L"Sample Grabber");
        if (FAILED(hr)) {
            grabberFilter->Release();
            return false;
        }
        
        // Connect capture filter to sample grabber
        hr = captureGraph->RenderStream(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video,
                                        captureFilter, nullptr, grabberFilter);
        if (FAILED(hr)) {
            grabberFilter->Release();
            return false;
        }
        
        grabberFilter->Release();
        
        // Set frame rate
        IAMStreamConfig* streamConfig = nullptr;
        hr = captureGraph->FindInterface(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video,
                                        captureFilter, IID_IAMStreamConfig, (void**)&streamConfig);
        if (SUCCEEDED(hr)) {
            VIDEOINFOHEADER* vih = nullptr;
            int size = 0;
            hr = streamConfig->GetFormat(&vih, &size);
            if (SUCCEEDED(hr) && vih) {
                vih->AvgTimePerFrame = (LONGLONG)(10000000.0 / frameRate);
                streamConfig->SetFormat(vih, size);
                CoTaskMemFree(vih);
            }
            streamConfig->Release();
        }
        
        return true;
    }
    
    bool Start() {
        if (!mediaControl || isRunning) return false;
        
        HRESULT hr = mediaControl->Run();
        if (SUCCEEDED(hr)) {
            isRunning = true;
            return true;
        }
        return false;
    }
    
    void Stop() {
        if (mediaControl && isRunning) {
            mediaControl->Stop();
            isRunning = false;
        }
        
        if (mediaEvent) {
            mediaEvent->Release();
            mediaEvent = nullptr;
        }
        
        if (mediaControl) {
            mediaControl->Release();
            mediaControl = nullptr;
        }
        
        if (sampleGrabber) {
            sampleGrabber->Release();
            sampleGrabber = nullptr;
        }
        
        if (captureFilter) {
            captureFilter->Release();
            captureFilter = nullptr;
        }
        
        if (captureGraph) {
            captureGraph->Release();
            captureGraph = nullptr;
        }
        
        if (graph) {
            graph->Release();
            graph = nullptr;
        }
    }
    
    napi_value GetFrame(napi_env env) {
        if (!sampleGrabber || !isRunning) {
            return nullptr;
        }
        
        long bufferSize = 0;
        HRESULT hr = sampleGrabber->GetCurrentBuffer(&bufferSize, nullptr);
        if (FAILED(hr) || bufferSize <= 0) {
            return nullptr;
        }
        
        std::vector<BYTE> buffer(bufferSize);
        hr = sampleGrabber->GetCurrentBuffer(&bufferSize, (long*)buffer.data());
        if (FAILED(hr)) {
            return nullptr;
        }
        
        // Create Node.js Buffer
        napi_value result;
        void* data;
        hr = napi_create_buffer_copy(env, bufferSize, buffer.data(), &data, &result);
        if (FAILED(hr)) {
            return nullptr;
        }
        
        return result;
    }
    
private:
    HRESULT FindCaptureDevice(const char* deviceName, IBaseFilter** filter) {
        ICreateDevEnum* devEnum = nullptr;
        IEnumMoniker* enumMoniker = nullptr;
        IMoniker* moniker = nullptr;
        IPropertyBag* propBag = nullptr;
        
        HRESULT hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                     IID_ICreateDevEnum, (void**)&devEnum);
        if (FAILED(hr)) return hr;
        
        hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDevice, &enumMoniker, 0);
        if (FAILED(hr)) {
            devEnum->Release();
            return hr;
        }
        
        while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
            hr = moniker->BindToStorage(nullptr, nullptr, IID_IPropertyBag, (void**)&propBag);
            if (SUCCEEDED(hr)) {
                VARIANT var;
                VariantInit(&var);
                hr = propBag->Read(L"FriendlyName", &var, nullptr);
                if (SUCCEEDED(hr) && var.vt == VT_BSTR) {
                    std::wstring wideName(var.bstrVal);
                    std::string name(wideName.begin(), wideName.end());
                    
                    if (name.find(deviceName) != std::string::npos) {
                        hr = moniker->BindToObject(nullptr, nullptr, IID_IBaseFilter, (void**)filter);
                        VariantClear(&var);
                        propBag->Release();
                        moniker->Release();
                        enumMoniker->Release();
                        devEnum->Release();
                        return hr;
                    }
                }
                VariantClear(&var);
                propBag->Release();
            }
            moniker->Release();
        }
        
        enumMoniker->Release();
        devEnum->Release();
        return E_FAIL;
    }
};

// Native module exports
static DirectShowCapture* g_capture = nullptr;

napi_value Initialize(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    if (argc < 2) {
        napi_throw_error(env, nullptr, "Expected device name and frame rate arguments");
        return nullptr;
    }
    
    size_t deviceNameLen;
    napi_get_value_string_utf8(env, args[0], nullptr, 0, &deviceNameLen);
    std::vector<char> deviceName(deviceNameLen + 1);
    napi_get_value_string_utf8(env, args[0], deviceName.data(), deviceNameLen + 1, &deviceNameLen);
    
    int32_t frameRate;
    napi_get_value_int32(env, args[1], &frameRate);
    
    if (g_capture) {
        delete g_capture;
    }
    
    g_capture = new DirectShowCapture();
    bool success = g_capture->Initialize(deviceName.data(), frameRate);
    
    napi_value result;
    napi_get_boolean(env, success, &result);
    return result;
}

napi_value Start(napi_env env, napi_callback_info info) {
    if (!g_capture) {
        napi_throw_error(env, nullptr, "Capture not initialized");
        return nullptr;
    }
    
    bool success = g_capture->Start();
    napi_value result;
    napi_get_boolean(env, success, &result);
    return result;
}

napi_value Stop(napi_env env, napi_callback_info info) {
    if (g_capture) {
        g_capture->Stop();
        delete g_capture;
        g_capture = nullptr;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

napi_value GetFrame(napi_env env, napi_callback_info info) {
    if (!g_capture) {
        napi_throw_error(env, nullptr, "Capture not initialized");
        return nullptr;
    }
    
    napi_value frame = g_capture->GetFrame(env);
    if (!frame) {
        napi_get_null(env, &frame);
    }
    
    return frame;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        {"initialize", nullptr, Initialize, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"stop", nullptr, Stop, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"getFrame", nullptr, GetFrame, nullptr, nullptr, nullptr, napi_default, nullptr}
    };
    
    napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
