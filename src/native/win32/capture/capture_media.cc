#include "headers/capture_media.h"
#include "headers/capture_state.h"
#include "../logger.h"

#include <iostream>

namespace {
    inline unsigned char ClampToByte(int value) {
        if (value < 0) {
            return 0;
        }
        if (value > 255) {
            return 255;
        }
        return static_cast<unsigned char>(value);
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

void ConfigureBitmapInfo(const BITMAPINFOHEADER& header, DWORD imageSize) {
    g_frameWidth = header.biWidth;
    g_frameHeight = header.biHeight;

    g_bitmapInfoHeader = {};
    g_bitmapInfoHeader.biSize = sizeof(BITMAPINFOHEADER);
    g_bitmapInfoHeader.biWidth = header.biWidth;
    g_bitmapInfoHeader.biHeight = header.biHeight; // Use positive height for standard bottom-up BMP
    g_bitmapInfoHeader.biPlanes = 1;
    g_bitmapInfoHeader.biBitCount = header.biBitCount ? header.biBitCount : 24;
    g_bitmapInfoHeader.biCompression = header.biCompression;
    g_bitmapInfoHeader.biSizeImage = imageSize;

    g_hasMediaInfo = true;

    LOG_MAIN("Configured bitmap info " << g_frameWidth << "x" << g_frameHeight
              << " (" << g_bitmapInfoHeader.biBitCount << "bpp, size " << imageSize << ")");
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
        dest.pbFormat = static_cast<BYTE*>(CoTaskMemAlloc(src->cbFormat));
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
    
    // Convert to top-down RGB format (standard for image processing)
    for (int y = 0; y < absHeight; ++y) {
        const uint8_t* srcRow = src + y * srcStride;
        uint8_t* dstRow = dst.data() + y * dstStride; // Top-down: no vertical flip
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
            pixel0[0] = ClampToByte(r0); // R
            pixel0[1] = ClampToByte(g0); // G
            pixel0[2] = ClampToByte(b0); // B
            pixel1[0] = ClampToByte(r1); // R
            pixel1[1] = ClampToByte(g1); // G
            pixel1[2] = ClampToByte(b1); // B
        }
    }
}

std::vector<uint8_t> BuildBitmapData(const BITMAPINFOHEADER& infoHeader, const uint8_t* pixelData, long pixelSize) {
    BITMAPFILEHEADER fileHeader{};
    fileHeader.bfType = 'MB';
    fileHeader.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
    fileHeader.bfSize = fileHeader.bfOffBits + pixelSize;

    std::vector<uint8_t> bmpData(fileHeader.bfSize);
    std::memcpy(bmpData.data(), &fileHeader, sizeof(BITMAPFILEHEADER));
    std::memcpy(bmpData.data() + sizeof(BITMAPFILEHEADER), &infoHeader, sizeof(BITMAPINFOHEADER));
    std::memcpy(bmpData.data() + fileHeader.bfOffBits, pixelData, pixelSize);
    return bmpData;
}
