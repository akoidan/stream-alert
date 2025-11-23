#pragma once

#include <dshow.h>
#include <string>
#include <map>

IPin* FindPinByDirection(IBaseFilter* filter, PIN_DIRECTION direction);
IPin* FindPinByName(IBaseFilter* filter, const std::wstring& targetName);
IBaseFilter* FindCaptureDevice(const std::wstring& deviceName);
std::map<std::string, std::string> GetAvailableCameras();
