#pragma once
#include <windows.h>

class FrameBuffer {
private:
    BYTE* data;
    size_t size;
    size_t capacity;
    
public:
    FrameBuffer();
    ~FrameBuffer();
    
    void Append(const BYTE* newData, size_t newSize);
    void Clear();
    const BYTE* GetData() const;
    size_t GetSize() const;
};
