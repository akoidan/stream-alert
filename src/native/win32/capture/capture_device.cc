#include "headers/capture_device.h"

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

    while (enumMoniker->Next(1, &moniker, nullptr) == S_OK) {
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
