#pragma once
#include <string>
#include <vector>

std::vector<std::string> GetVideoDeviceList();
bool DeviceExists(const std::string& deviceName);
