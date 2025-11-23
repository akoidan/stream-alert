#pragma once

#include <dshow.h>
#include <string>

IPin* FindPinByDirection(IBaseFilter* filter, PIN_DIRECTION direction);
IPin* FindPinByName(IBaseFilter* filter, const std::wstring& targetName);
IBaseFilter* FindCaptureDevice(const std::wstring& deviceName);
