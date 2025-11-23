#include "capture_device.h"
#include "logger.h"
#include <sstream>
#include <locale>
#include <codecvt>

std::string WideStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return std::string();
    std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
    return converter.to_bytes(wstr);
}

IPin* FindPinByDirection(IBaseFilter* filter, PIN_DIRECTION direction) {
    if (!filter) {
        return nullptr;
    }

    IEnumPins* enumPins = nullptr;
    if (FAILED(filter->EnumPins(&enumPins)) || !enumPins) {
        return nullptr;
    }

    IPin* foundPin = nullptr;
    IPin* pin = nullptr;
    while (enumPins->Next(1, &pin, nullptr) == S_OK) {
        PIN_DIRECTION pinDir;
        if (SUCCEEDED(pin->QueryDirection(&pinDir)) && pinDir == direction) {
            foundPin = pin;
            break;
        }
        pin->Release();
    }
    enumPins->Release();
    return foundPin;
}

IPin* FindPinByName(IBaseFilter* filter, const std::wstring& targetName) {
    if (!filter) {
        return nullptr;
    }

    IEnumPins* enumPins = nullptr;
    if (FAILED(filter->EnumPins(&enumPins)) || !enumPins) {
        return nullptr;
    }

    IPin* foundPin = nullptr;
    IPin* pin = nullptr;
    while (enumPins->Next(1, &pin, nullptr) == S_OK) {
        PIN_INFO info = {};
        if (SUCCEEDED(pin->QueryPinInfo(&info))) {
            std::wstring pinName(info.achName ? info.achName : L"");
            if (pinName == targetName) {
                foundPin = pin;
            }
            if (info.pFilter) {
                info.pFilter->Release();
            }
        }
        if (foundPin) {
            break;
        }
        pin->Release();
    }
    enumPins->Release();
    return foundPin;
}

IBaseFilter* FindCaptureDevice(const std::wstring& deviceName) {
    ICreateDevEnum* devEnum = nullptr;
    IEnumMoniker* enumMoniker = nullptr;
    IMoniker* moniker = nullptr;

    HRESULT hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) {
        return nullptr;
    }

    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
    if (FAILED(hr) || !enumMoniker) {
        devEnum->Release();
        return nullptr;
    }

    // Check if deviceName is in "video://N" format or just a number
    int targetIndex = -1;
    
    // Try to parse as a number first (for converted video://N)
    try {
        targetIndex = std::stoi(deviceName);
    } catch (...) {
        targetIndex = -1;
    }

    int currentIndex = 0;
    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
        // If looking for specific index, check if this is the one
        if (targetIndex >= 0) {
            if (currentIndex == targetIndex) {
                IBaseFilter* filter = nullptr;
                hr = moniker->BindToObject(0, 0, IID_IBaseFilter, (void**)&filter);
                if (SUCCEEDED(hr)) {
                    moniker->Release();
                    enumMoniker->Release();
                    devEnum->Release();
                    return filter;
                }
            }
            currentIndex++;
            moniker->Release();
            continue;
        }

        // Original logic for name-based search
        IPropertyBag* propBag = nullptr;
        hr = moniker->BindToStorage(0, 0, IID_IPropertyBag, (void**)&propBag);
        if (SUCCEEDED(hr)) {
            VARIANT var;
            VariantInit(&var);
            hr = propBag->Read(L"FriendlyName", &var, 0);
            if (SUCCEEDED(hr) && var.vt == VT_BSTR) {
                std::wstring friendlyName = var.bstrVal;
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

std::map<std::string, std::string> GetAvailableCameras() {
    std::map<std::string, std::string> cameras;
    
    ICreateDevEnum* devEnum = nullptr;
    IEnumMoniker* enumMoniker = nullptr;
    IMoniker* moniker = nullptr;

    HRESULT hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) {
        LOG_MAIN("Failed to create device enumerator");
        return cameras;
    }

    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDeviceCategory, &enumMoniker, 0);
    if (FAILED(hr) || !enumMoniker) {
        devEnum->Release();
        LOG_MAIN("Failed to create class enumerator for video devices");
        return cameras;
    }

    int deviceIndex = 0;
    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
        IPropertyBag* propBag = nullptr;
        hr = moniker->BindToStorage(0, 0, IID_IPropertyBag, (void**)&propBag);
        if (SUCCEEDED(hr)) {
            VARIANT var;
            VariantInit(&var);
            hr = propBag->Read(L"FriendlyName", &var, 0);
            if (SUCCEEDED(hr) && var.vt == VT_BSTR) {
                std::wstring friendlyNameW = var.bstrVal;
                std::string friendlyName = WideStringToString(friendlyNameW);
                
                // Create a device path that can be used to uniquely identify this device
                std::string devicePath = "video://" + std::to_string(deviceIndex);
                
                // Ensure unique name by adding index if needed
                std::string uniqueName = friendlyName;
                int suffix = 2;
                while (cameras.find(uniqueName) != cameras.end()) {
                    uniqueName = friendlyName + " (" + std::to_string(suffix++) + ")";
                }
                
                cameras[uniqueName] = devicePath;
                LOG_MAIN("Found camera: " << uniqueName << " -> " << devicePath);
                
                VariantClear(&var);
            }
            propBag->Release();
        }
        moniker->Release();
        deviceIndex++;
    }

    enumMoniker->Release();
    devEnum->Release();
    
    LOG_MAIN("Found " << cameras.size() << " video capture devices");
    return cameras;
}
