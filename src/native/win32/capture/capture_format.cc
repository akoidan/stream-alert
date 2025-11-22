#include "headers/capture_format.h"
#include "headers/capture_media.h"
#include "../logger.h"

#include <iostream>
#include <vector>

namespace {
    void LogCapability(int index, const AM_MEDIA_TYPE* mediaType) {
        if (!mediaType) {
            return;
        }

        LOG_MAIN(" Cap #" << index
                  << " major=" << GuidToString(mediaType->majortype)
                  << " subtype=" << GuidToString(mediaType->subtype)
                  << " format=" << GuidToString(mediaType->formattype));

        if (mediaType->formattype == FORMAT_VideoInfo && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER)) {
            auto* vih = reinterpret_cast<VIDEOINFOHEADER*>(mediaType->pbFormat);
            if (vih) {
                auto fps = vih->AvgTimePerFrame ? 10000000LL / vih->AvgTimePerFrame : 0;
                LOG_MAIN("    VideoInfo " << vih->bmiHeader.biWidth << "x"
                          << vih->bmiHeader.biHeight << " @ " << fps << " fps");
            }
        } else if (mediaType->formattype == FORMAT_VideoInfo2 && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER2)) {
            auto* vih2 = reinterpret_cast<VIDEOINFOHEADER2*>(mediaType->pbFormat);
            if (vih2) {
                auto fps = vih2->AvgTimePerFrame ? 10000000LL / vih2->AvgTimePerFrame : 0;
                LOG_MAIN("    VideoInfo2 " << vih2->bmiHeader.biWidth << "x"
                          << vih2->bmiHeader.biHeight << " @ " << fps << " fps");
            }
        }
    }

    void CopyDimensions(const AM_MEDIA_TYPE* mediaType, LONG& width, LONG& height, LONGLONG& avgTimePerFrame) {
        if (!mediaType || !mediaType->pbFormat) {
            return;
        }

        if (mediaType->formattype == FORMAT_VideoInfo && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER)) {
            auto* vih = reinterpret_cast<VIDEOINFOHEADER*>(mediaType->pbFormat);
            width = vih->bmiHeader.biWidth;
            height = vih->bmiHeader.biHeight;
            avgTimePerFrame = vih->AvgTimePerFrame;
        } else if (mediaType->formattype == FORMAT_VideoInfo2 && mediaType->cbFormat >= sizeof(VIDEOINFOHEADER2)) {
            auto* vih2 = reinterpret_cast<VIDEOINFOHEADER2*>(mediaType->pbFormat);
            width = vih2->bmiHeader.biWidth;
            height = vih2->bmiHeader.biHeight;
            avgTimePerFrame = vih2->AvgTimePerFrame;
        }
    }
}

CaptureFormatSelection SelectCaptureFormat(IAMStreamConfig* streamConfig) {
    CaptureFormatSelection selection;
    if (!streamConfig) {
        return selection;
    }

    int capabilityCount = 0;
    int capabilitySize = 0;
    HRESULT hr = streamConfig->GetNumberOfCapabilities(&capabilityCount, &capabilitySize);
    if (FAILED(hr) || capabilityCount <= 0 || capabilitySize <= 0) {
        LOG_MAIN("GetNumberOfCapabilities failed (hr=" << std::hex << hr << std::dec << ")");
        return selection;
    }

    LOG_MAIN("IAMStreamConfig reports " << capabilityCount
              << " capabilities (capSize=" << capabilitySize << ").");

    std::vector<BYTE> capabilityBuffer(capabilitySize);
    AM_MEDIA_TYPE chosenFormat = {};
    bool hasChosenFormat = false;

    for (int i = 0; i < capabilityCount; ++i) {
        AM_MEDIA_TYPE* mediaType = nullptr;
        hr = streamConfig->GetStreamCaps(i, &mediaType, capabilityBuffer.data());
        if (FAILED(hr) || !mediaType) {
            LOG_MAIN(" Cap #" << i << " query failed (hr=" << std::hex << hr << std::dec << ")");
            continue;
        }

        LogCapability(i, mediaType);

        const bool isRgb = mediaType->subtype == MEDIASUBTYPE_RGB24 || mediaType->subtype == MEDIASUBTYPE_RGB32;
        const bool isYuy2 = mediaType->subtype == MEDIASUBTYPE_YUY2;
        bool takeCandidate = false;

        if (isRgb) {
            takeCandidate = true;
            selection.isYuy2 = false;
        } else if (!hasChosenFormat && isYuy2) {
            takeCandidate = true;
            selection.isYuy2 = true;
        }

        if (takeCandidate) {
            CopyMediaType(chosenFormat, mediaType);
            hasChosenFormat = true;
            selection.subtype = mediaType->subtype;
            CopyDimensions(mediaType, selection.width, selection.height, selection.avgTimePerFrame);

            if (isRgb) {
                FreeMediaTypeContent(*mediaType);
                CoTaskMemFree(mediaType);
                break;
            }
        }

        FreeMediaTypeContent(*mediaType);
        CoTaskMemFree(mediaType);
    }

    if (hasChosenFormat) {
        hr = streamConfig->SetFormat(&chosenFormat);
        if (FAILED(hr)) {
            LOG_MAIN("Warning: IAMStreamConfig::SetFormat failed (hr=" << std::hex << hr
                      << std::dec << "), continuing with device default format.");
        } else {
            LOG_MAIN("Capture format set successfully (subtype=" << GuidToString(chosenFormat.subtype)
                      << ").");
        }
    }

    FreeMediaTypeContent(chosenFormat);
    return selection;
}
