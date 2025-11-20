#include "headers/capture_callback.h"
#include "headers/capture_media.h"

#include <iostream>
#include <memory>

SampleGrabberCallback g_callback;

STDMETHODIMP SampleGrabberCallback::QueryInterface(REFIID riid, void** ppv) {
    if (riid == IID_IUnknown || riid == DexterLib::IID_ISampleGrabberCB) {
        *ppv = static_cast<DexterLib::ISampleGrabberCB*>(this);
        AddRef();
        return S_OK;
    }
    return E_NOINTERFACE;
}

STDMETHODIMP SampleGrabberCallback::SampleCB(double sampleTime, DexterLib::IMediaSample* pSample) {
    if (!pSample) {
        return S_OK;
    }

    BYTE* buffer = nullptr;
    if (FAILED(pSample->GetPointer(&buffer)) || !buffer) {
        return S_OK;
    }

    long actualSize = pSample->GetActualDataLength();
    return ProcessBuffer(sampleTime, buffer, actualSize);
}

STDMETHODIMP SampleGrabberCallback::BufferCB(double sampleTime, BYTE* pBuffer, long bufferLen) {
    return ProcessBuffer(sampleTime, pBuffer, bufferLen);
}

HRESULT SampleGrabberCallback::ProcessBuffer(double sampleTime, BYTE* pBuffer, long bufferLen) {
    if (!pBuffer) {
        return S_OK;
    }

    if (!ValidateCaptureState()) {
        return S_OK;
    }

    auto sampleIndex = ++g_rawSamples;
    if (sampleIndex <= 5) {
        std::cout << "[capture] SampleGrabber sampleIndex=" << sampleIndex << ", bufferLen=" << bufferLen
                  << ", sampleTime=" << sampleTime << std::endl;
    }

    if (!HasValidMediaInfo()) {
        return S_OK;
    }

    if (!ValidateSampleSize(bufferLen)) {
        return S_OK;
    }

    BITMAPINFOHEADER infoHeader = PrepareInfoHeader(bufferLen);
    const uint8_t* pixelData = pBuffer;
    long pixelSize = bufferLen;
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
    }

    UpdateFrameData(infoHeader, pixelData, pixelSize);
    DispatchFrame(infoHeader);
    return S_OK;
}

bool SampleGrabberCallback::ValidateCaptureState() {
    static std::atomic<bool> loggedInactive{false};
    if (g_isCapturing) {
        loggedInactive.store(false);
        return true;
    }

    if (!loggedInactive.exchange(true)) {
        std::cout << "[capture] SampleGrabber invoked while g_isCapturing=false (dropping frames)" << std::endl;
    }
    return false;
}

bool SampleGrabberCallback::HasValidMediaInfo() {
    static std::atomic<bool> loggedNoMediaInfo{false};
    if (g_hasMediaInfo) {
        loggedNoMediaInfo.store(false);
        return true;
    }

    if (!loggedNoMediaInfo.exchange(true)) {
        std::cout << "[capture] SampleGrabber received data before media info configured; dropping sample." << std::endl;
    }
    return false;
}

bool SampleGrabberCallback::ValidateSampleSize(long dataSize) {
    static std::atomic<bool> loggedEmptySample{false};
    if (dataSize > 0) {
        loggedEmptySample.store(false);
        return true;
    }

    if (!loggedEmptySample.exchange(true)) {
        std::cout << "[capture] SampleGrabber reported zero-length sample; waiting for valid buffers." << std::endl;
    }
    return false;
}

BITMAPINFOHEADER SampleGrabberCallback::PrepareInfoHeader(long pixelSize) {
    BITMAPINFOHEADER infoHeader = g_bitmapInfoHeader;
    infoHeader.biSizeImage = pixelSize;
    return infoHeader;
}

void SampleGrabberCallback::UpdateFrameData(const BITMAPINFOHEADER& infoHeader, const uint8_t* pixelData, long pixelSize) {
    auto bmpData = BuildBitmapData(infoHeader, pixelData, pixelSize);
    std::lock_guard<std::mutex> lock(g_frameMutex);
    g_frameData = std::move(bmpData);
}

void SampleGrabberCallback::DispatchFrame(const BITMAPINFOHEADER& infoHeader) {
    auto now = std::chrono::steady_clock::now();
    auto interval = g_targetFps > 0 ? std::chrono::milliseconds(1000 / g_targetFps)
                                   : std::chrono::milliseconds(0);

    if (interval.count() != 0 && now - g_lastCallbackTime < interval) {
        auto sampleIndex = g_rawSamples.load();
        if (sampleIndex % 30 == 0) {
            auto waitMs = std::chrono::duration_cast<std::chrono::milliseconds>(interval - (now - g_lastCallbackTime)).count();
            std::cout << "[capture] Dropping frame due to FPS gate. sampleIndex=" << sampleIndex
                      << ", waiting ~" << waitMs << "ms" << std::endl;
        }
        return;
    }

    g_lastCallbackTime = now;
    if (!g_callbackFunction) {
        return;
    }

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
