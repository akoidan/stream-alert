#pragma once

#include "capture.h"
#include "capture_state.h"
#include "capture_media.h"

class SampleGrabberCallback : public DexterLib::ISampleGrabberCB {
public:
    STDMETHODIMP_(ULONG) AddRef() override { return 1; }
    STDMETHODIMP_(ULONG) Release() override { return 1; }
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override;
    STDMETHODIMP SampleCB(double sampleTime, DexterLib::IMediaSample* pSample) override;
    STDMETHODIMP BufferCB(double sampleTime, BYTE* pBuffer, long bufferLen) override;

private:
    HRESULT ProcessBuffer(double sampleTime, BYTE* pBuffer, long bufferLen);
    bool ValidateCaptureState();
    bool HasValidMediaInfo();
    bool ValidateSampleSize(long dataSize);
    void UpdateFrameData(const BITMAPINFOHEADER& infoHeader, const uint8_t* pixelData, long pixelSize);
    void DispatchFrame(const BITMAPINFOHEADER& infoHeader);
    BITMAPINFOHEADER PrepareInfoHeader(long pixelSize);
};

extern SampleGrabberCallback g_callback;
