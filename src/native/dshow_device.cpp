#include "dshow_device.h"
#include <windows.h>
#include <dshow.h>
#include <strmiids.h>
#include <iostream>
#include <vector>

#pragma comment(lib, "strmiids.lib")
#pragma comment(lib, "ole32.lib")

std::vector<std::string> GetVideoDeviceList() {
    std::vector<std::string> devices;
    
    ICreateDevEnum* devEnum = nullptr;
    IEnumMoniker* enumMoniker = nullptr;
    IMoniker* moniker = nullptr;
    IPropertyBag* propBag = nullptr;
    
    HRESULT hr = CoCreateInstance(CLSID_SystemDeviceEnum, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_ICreateDevEnum, (void**)&devEnum);
    if (FAILED(hr)) return devices;
    
    hr = devEnum->CreateClassEnumerator(CLSID_VideoInputDevice, &enumMoniker, 0);
    if (FAILED(hr)) {
        devEnum->Release();
        return devices;
    }
    
    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
        hr = moniker->BindToStorage(nullptr, nullptr, IID_IPropertyBag, (void**)&propBag);
        if (SUCCEEDED(hr)) {
            VARIANT var;
            VariantInit(&var);
            hr = propBag->Read(L"FriendlyName", &var, nullptr);
            if (SUCCEEDED(hr) && var.vt == VT_BSTR) {
                std::wstring wideName(var.bstrVal);
                std::string name(wideName.begin(), wideName.end());
                devices.push_back(name);
            }
            VariantClear(&var);
            propBag->Release();
        }
        moniker->Release();
    }
    
    enumMoniker->Release();
    devEnum->Release();
    
    return devices;
}

bool DeviceExists(const std::string& deviceName) {
    auto devices = GetVideoDeviceList();
    for (const auto& device : devices) {
        if (device.find(deviceName) != std::string::npos) {
            return true;
        }
    }
    return false;
}
