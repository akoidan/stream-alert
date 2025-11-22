#pragma once

#include <string>
#include <vector>
#include <windows.h>
#include <dshow.h>
#include <dvdmedia.h>

std::string GuidToString(const GUID& guid);
void ConfigureBitmapInfo(const BITMAPINFOHEADER& header, DWORD imageSize);
void FreeMediaTypeContent(AM_MEDIA_TYPE& mt);
void CopyMediaType(AM_MEDIA_TYPE& dest, const AM_MEDIA_TYPE* src);
void ConvertYuy2ToRgb24(const uint8_t* src, int width, int height, std::vector<uint8_t>& dst);
std::vector<uint8_t> BuildBitmapData(const BITMAPINFOHEADER& infoHeader, const uint8_t* pixelData, long pixelSize);
