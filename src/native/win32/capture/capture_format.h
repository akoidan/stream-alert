#pragma once

#include <dshow.h>
#include <dvdmedia.h>

struct CaptureFormatSelection {
    GUID subtype = MEDIASUBTYPE_YUY2;
    bool isYuy2 = true;
    LONG width = 0;
    LONG height = 0;
    LONGLONG avgTimePerFrame = 0;
};

CaptureFormatSelection SelectCaptureFormat(IAMStreamConfig* streamConfig);
