#include "headers/capture.h"
#include <iostream>
#include <memory>
#include <chrono>
#include <stdexcept>
#include <cstring>
#include <mutex>
#include <vector>
#include <atomic>
#include <cstring>
#include <cstdlib>
#include <dshow.h>
#include <dvdmedia.h>
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
std::atomic<uint64_t> g_rawSamples{0};

// Frame dimensions
int g_frameWidth = 0;
int g_frameHeight = 0;

BITMAPINFOHEADER g_bitmapInfoHeader = {};
bool g_hasMediaInfo = false;
bool g_captureFormatIsYuy2 = false;

// Callback reference
Napi::ThreadSafeFunction g_callbackFunction;

namespace {
    void ReleaseCallbackFunction() {
        if (g_callbackFunction) {
            g_callbackFunction.Release();
            g_callbackFunction = nullptr;
        }
    }

    void ConfigureBitmapInfo(const BITMAPINFOHEADER& header, DWORD imageSize) {
        g_frameWidth = header.biWidth;
        g_frameHeight = header.biHeight;

        g_bitmapInfoHeader = {};
        g_bitmapInfoHeader.biSize = sizeof(BITMAPINFOHEADER);
        g_bitmapInfoHeader.biWidth = header.biWidth;
        g_bitmapInfoHeader.biHeight = header.biHeight;
        g_bitmapInfoHeader.biPlanes = 1;
        g_bitmapInfoHeader.biBitCount = header.biBitCount ? header.biBitCount : 24;
        g_bitmapInfoHeader.biCompression = header.biCompression;
        g_bitmapInfoHeader.biSizeImage = imageSize;

        g_hasMediaInfo = true;

        std::cout << "[capture] Configured bitmap info " << g_frameWidth << "x" << g_frameHeight
                  << " (" << g_bitmapInfoHeader.biBitCount << "bpp, size " << imageSize << ")" << std::endl;
    }

    [[noreturn]] void ThrowCaptureError(Napi::Env env, const char* message) {
        ReleaseCallbackFunction();
        throw Napi::Error::New(env, message);
    }
}

std::string GuidToString(const GUID& guid) {
    LPOLESTR guidString = nullptr;
    if (StringFromCLSID(guid, &guidString) == S_OK && guidString) {
        std::wstring wideStr(guidString);
        CoTaskMemFree(guidString);
        return std::string(wideStr.begin(), wideStr.end());
    }
    return "<unknown-guid>";
}

inline unsigned char ClampToByte(int value) {
    if (value < 0) return 0;
    if (value > 255) return 255;
    return static_cast<unsigned char>(value);
}

void FreeMediaTypeContent(AM_MEDIA_TYPE& mt) {
    if (mt.cbFormat && mt.pbFormat) {
        CoTaskMemFree(mt.pbFormat);
        mt.pbFormat = nullptr;
        mt.cbFormat = 0;
    }
    if (mt.pUnk) {
        mt.pUnk->Release();
        mt.pUnk = nullptr;
    }
}

void CopyMediaType(AM_MEDIA_TYPE& dest, const AM_MEDIA_TYPE* src) {
    FreeMediaTypeContent(dest);
    dest = *src;
    if (src->cbFormat && src->pbFormat) {
        dest.pbFormat = (BYTE*)CoTaskMemAlloc(src->cbFormat);
        if (dest.pbFormat) {
            std::memcpy(dest.pbFormat, src->pbFormat, src->cbFormat);
            dest.cbFormat = src->cbFormat;
        } else {
            dest.cbFormat = 0;
        }
    } else {
        dest.cbFormat = 0;
        dest.pbFormat = nullptr;
    }
    dest.pUnk = nullptr;
}

void ConvertYuy2ToRgb24(const uint8_t* src, int width, int height, std::vector<uint8_t>& dst) {
    int absHeight = std::abs(height);
    dst.resize(static_cast<size_t>(width) * absHeight * 3);
    int srcStride = width * 2;
    int dstStride = width * 3;
    for (int y = 0; y < absHeight; ++y) {
        const uint8_t* srcRow = src + y * srcStride;
        uint8_t* dstRow = dst.data() + y * dstStride;
        for (int x = 0; x < width; x += 2) {
            int idx = x * 2;
            int y0 = srcRow[idx + 0];
            int u = srcRow[idx + 1];
            int y1 = srcRow[idx + 2];
            int v = srcRow[idx + 3];
            int d = u - 128;
            int e = v - 128;
            int c0 = y0 - 16;
            int c1 = y1 - 16;
            int r0 = (298 * c0 + 409 * e + 128) >> 8;
            int g0 = (298 * c0 - 100 * d - 208 * e + 128) >> 8;
            int b0 = (298 * c0 + 516 * d + 128) >> 8;
            int r1 = (298 * c1 + 409 * e + 128) >> 8;
            int g1 = (298 * c1 - 100 * d - 208 * e + 128) >> 8;
            int b1 = (298 * c1 + 516 * d + 128) >> 8;
            uint8_t* pixel0 = dstRow + x * 3;
            uint8_t* pixel1 = dstRow + (x + 1) * 3;
            pixel0[2] = ClampToByte(r0);
            pixel0[1] = ClampToByte(g0);
            pixel0[0] = ClampToByte(b0);
            pixel1[2] = ClampToByte(r1);
            pixel1[1] = ClampToByte(g1);
            pixel1[0] = ClampToByte(b1);
        }
    }
}

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
        static std::atomic<bool> loggedInactive{false};

        if (!pBuffer) {
            return S_OK;
        }

        if (!g_isCapturing) {
            if (!loggedInactive.exchange(true)) {
                std::cout << "[capture] BufferCB invoked while g_isCapturing=false (dropping frames)" << std::endl;
            }
            return S_OK;
        }

        auto sampleIndex = ++g_rawSamples;
        if (sampleIndex <= 5) {
            std::cout << "[capture] BufferCB sampleIndex=" << sampleIndex << ", bufferLen=" << bufferLen
                      << ", sampleTime=" << sampleTime << std::endl;
        }
        
        long dataSize = bufferLen;
        if (dataSize > 0 && g_hasMediaInfo) {
            BITMAPINFOHEADER infoHeader = g_bitmapInfoHeader;
            const uint8_t* pixelData = pBuffer;
            long pixelSize = dataSize;
            std::vector<uint8_t> convertedBuffer;
            if (g_captureFormatIsYuy2) {
                int width = g_frameWidth != 0 ? g_frameWidth : infoHeader.biWidth;
                int height = g_frameHeight != 0 ? g_frameHeight : infoHeader.biHeight;
                ConvertYuy2ToRgb24(pBuffer, width, height, convertedBuffer);
                pixelData = convertedBuffer.data();
                pixelSize = static_cast<long>(convertedBuffer.size());
                infoHeader.biCompression = BI_RGB;
                infoHeader.biBitCount = 24;
                infoHeader.biSizeImage = pixelSize;
            } else {
                infoHeader.biSizeImage = pixelSize;
            }

            BITMAPFILEHEADER fileHeader{};
            fileHeader.bfType = 'MB';
            fileHeader.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
            fileHeader.bfSize = fileHeader.bfOffBits + pixelSize;

            auto bmpData = std::vector<uint8_t>(fileHeader.bfSize);
            std::memcpy(bmpData.data(), &fileHeader, sizeof(BITMAPFILEHEADER));
            std::memcpy(bmpData.data() + sizeof(BITMAPFILEHEADER), &infoHeader, sizeof(BITMAPINFOHEADER));
            std::memcpy(bmpData.data() + fileHeader.bfOffBits, pixelData, pixelSize);

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
            } else if (sampleIndex % 30 == 0) {
                auto waitMs = std::chrono::duration_cast<std::chrono::milliseconds>(interval - (now - g_lastCallbackTime)).count();
                std::cout << "[capture] Dropping frame due to FPS gate. sampleIndex=" << sampleIndex
                          << ", waiting ~" << waitMs << "ms" << std::endl;
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
    
    IAMStreamConfig* streamConfig = nullptr;
    GUID selectedSubtype = MEDIASUBTYPE_RGB24;
    bool selectedIsYuy2 = false;
    AM_MEDIA_TYPE chosenFormat;
    ZeroMemory(&chosenFormat, sizeof(chosenFormat));
    bool hasChosenFormat = false;

    hr = captureBuilder->FindInterface(&PIN_CATEGORY_CAPTURE, &MEDIATYPE_Video, g_videoFilter,
                                       IID_IAMStreamConfig, (void**)&streamConfig);
    if (SUCCEEDED(hr) && streamConfig) {
        int capCount = 0;
        int capSize = 0;
        hr = streamConfig->GetNumberOfCapabilities(&capCount, &capSize);
        if (SUCCEEDED(hr)) {
            std::cout << "[capture] IAMStreamConfig reports " << capCount
                      << " capabilities (capSize=" << capSize << ")." << std::endl;
            std::vector<BYTE> capabilityBuffer(capSize);
            for (int i = 0; i < capCount; ++i) {
                AM_MEDIA_TYPE* mediaType = nullptr;
                hr = streamConfig->GetStreamCaps(i, &mediaType, capabilityBuffer.data());
                if (SUCCEEDED(hr) && mediaType) {
                    std::cout << "[capture]  Cap #" << i
                              << " major=" << GuidToString(mediaType->majortype)
                              << " subtype=" << GuidToString(mediaType->subtype)
                              << " format=" << GuidToString(mediaType->formattype) << std::endl;

                    if (mediaType->formattype == FORMAT_VideoInfo && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER)) {
                        auto* pvi = reinterpret_cast<VIDEOINFOHEADER*>(mediaType->pbFormat);
                        if (pvi) {
                            std::cout << "[capture]    VideoInfo " << pvi->bmiHeader.biWidth << "x"
                                      << pvi->bmiHeader.biHeight << " @ "
                                      << (pvi->AvgTimePerFrame ? 10000000LL / pvi->AvgTimePerFrame : 0)
                                      << " fps" << std::endl;
                        }
                    } else if (mediaType->formattype == FORMAT_VideoInfo2 && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER2)) {
                        auto* pvi2 = reinterpret_cast<VIDEOINFOHEADER2*>(mediaType->pbFormat);
                        if (pvi2) {
                            std::cout << "[capture]    VideoInfo2 " << pvi2->bmiHeader.biWidth << "x"
                                      << pvi2->bmiHeader.biHeight << " @ "
                                      << (pvi2->AvgTimePerFrame ? 10000000LL / pvi2->AvgTimePerFrame : 0)
                                      << " fps" << std::endl;
                        }
                    }

                    bool isRgb = (mediaType->subtype == MEDIASUBTYPE_RGB24 || mediaType->subtype == MEDIASUBTYPE_RGB32);
                    bool isYuy2 = (mediaType->subtype == MEDIASUBTYPE_YUY2);
                    bool takeCandidate = false;
                    if (isRgb) {
                        takeCandidate = true;
                        selectedIsYuy2 = false;
                    } else if (!hasChosenFormat && isYuy2) {
                        takeCandidate = true;
                        selectedIsYuy2 = true;
                    }
                    if (takeCandidate) {
                        CopyMediaType(chosenFormat, mediaType);
                        hasChosenFormat = true;
                        selectedSubtype = mediaType->subtype;
                        if (isRgb) {
                            if (mediaType->cbFormat && mediaType->pbFormat) {
                                CoTaskMemFree(mediaType->pbFormat);
                                mediaType->pbFormat = nullptr;
                            }
                            if (mediaType->pUnk) {
                                mediaType->pUnk->Release();
                                mediaType->pUnk = nullptr;
                            }
                            CoTaskMemFree(mediaType);
                            break;
                        }
                    }

                    if (mediaType->cbFormat && mediaType->pbFormat) {
                        CoTaskMemFree(mediaType->pbFormat);
                        mediaType->pbFormat = nullptr;
                    }
                    if (mediaType->pUnk) {
                        mediaType->pUnk->Release();
                        mediaType->pUnk = nullptr;
                    }
                    CoTaskMemFree(mediaType);
                } else {
                    std::cout << "[capture]  Cap #" << i << " query failed (hr=" << std::hex << hr << ")" << std::endl;
                }
            }
        } else {
            std::cout << "[capture] GetNumberOfCapabilities failed (hr=" << std::hex << hr << ")" << std::endl;
        }
        if (hasChosenFormat) {
            hr = streamConfig->SetFormat(&chosenFormat);
            if (FAILED(hr)) {
                FreeMediaTypeContent(chosenFormat);
                streamConfig->Release();
                captureBuilder->Release();
                CleanupDirectShow();
                ThrowCaptureError(env, "Failed to set capture format");
            }
        }
        streamConfig->Release();
    } else {
        std::cout << "[capture] IAMStreamConfig not available (hr=" << std::hex << hr << ")" << std::endl;
    }

    DexterLib::_AMMediaType mt;
    ZeroMemory(&mt, sizeof(mt));
    mt.majortype = MEDIATYPE_Video;
    mt.subtype = selectedSubtype;
    mt.formattype = FORMAT_VideoInfo;
    mt.pbFormat = (unsigned char*)CoTaskMemAlloc(sizeof(VIDEOINFOHEADER));
    if (!mt.pbFormat) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to allocate media type format");
    }
    ZeroMemory(mt.pbFormat, sizeof(VIDEOINFOHEADER));

    VIDEOINFOHEADER* pvi = (VIDEOINFOHEADER*)mt.pbFormat;
    pvi->AvgTimePerFrame = 10000000LL / fps;
    pvi->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    pvi->bmiHeader.biWidth = 0;
    pvi->bmiHeader.biHeight = 0;
    pvi->bmiHeader.biPlanes = 1;
    if (selectedSubtype == MEDIASUBTYPE_RGB32) {
        pvi->bmiHeader.biBitCount = 32;
        pvi->bmiHeader.biCompression = BI_RGB;
        selectedIsYuy2 = false;
    } else if (selectedSubtype == MEDIASUBTYPE_RGB24) {
        pvi->bmiHeader.biBitCount = 24;
        pvi->bmiHeader.biCompression = BI_RGB;
        selectedIsYuy2 = false;
    } else {
        pvi->bmiHeader.biBitCount = 16;
        pvi->bmiHeader.biCompression = MAKEFOURCC('Y','U','Y','2');
        selectedIsYuy2 = true;
    }
    mt.cbFormat = sizeof(VIDEOINFOHEADER);

    hr = g_sampleGrabber->SetMediaType(&mt);
    if (mt.pbFormat) {
        CoTaskMemFree(mt.pbFormat);
    }
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set sample grabber media type");
    }

    hr = g_sampleGrabber->SetBufferSamples(TRUE);
    if (FAILED(hr)) {
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to set buffer samples");
    }

    hr = g_sampleGrabber->SetCallback(&g_callback, 1);
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
        std::cout << "[capture] Failed to connect capture pin (hr=" << std::hex << hr << ")" << std::endl;
        nullRenderer->Release();
        captureBuilder->Release();
        CleanupDirectShow();
        ThrowCaptureError(env, "Failed to connect capture stream");
    } else {
        std::cout << "[capture] Capture pin connected." << std::endl;
    }
    
    // Release null renderer (graph maintains reference)
    nullRenderer->Release();

    // Optionally connect preview pin to a null renderer to satisfy devices that expect it
    IBaseFilter* previewNullRenderer = nullptr;
    hr = CoCreateInstance(CLSID_NullRenderer, nullptr, CLSCTX_INPROC_SERVER,
                         IID_IBaseFilter, (void**)&previewNullRenderer);
    if (SUCCEEDED(hr)) {
        HRESULT previewHr = captureBuilder->RenderStream(&PIN_CATEGORY_PREVIEW, &MEDIATYPE_Video,
                                                         g_videoFilter, nullptr, previewNullRenderer);
        if (SUCCEEDED(previewHr)) {
            std::cout << "[capture] Preview pin connected to null renderer." << std::endl;
        } else {
            std::cout << "[capture] Preview pin connection failed (hr=" << std::hex << previewHr << ")" << std::endl;
        }
        previewNullRenderer->Release();
    } else {
        std::cout << "[capture] Failed to create preview null renderer (hr=" << std::hex << hr << ")" << std::endl;
    }
    
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
    if (SUCCEEDED(hr)) {
        std::cout << "[capture] Connected media type GUID: " << GuidToString(connectedMt.formattype)
                  << ", cbFormat=" << connectedMt.cbFormat << std::endl;
    } else {
        std::cout << "[capture] Failed to retrieve connected media type (hr=" << std::hex << hr << ")" << std::endl;
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

    g_isCapturing = g_hasMediaInfo;
    if (g_isCapturing) {
        std::cout << "[capture] Capture pipeline active." << std::endl;
    }
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
