#include "frame_buffer.h"
#include <cstring>

FrameBuffer::FrameBuffer() : data(nullptr), size(0), capacity(0) {}

FrameBuffer::~FrameBuffer() {
    if (data) {
        delete[] data;
    }
}

void FrameBuffer::Append(const BYTE* newData, size_t newSize) {
    if (capacity < size + newSize) {
        size_t newCapacity = (size + newSize) * 2;
        BYTE* newDataArray = new BYTE[newCapacity];
        
        if (data) {
            memcpy(newDataArray, data, size);
            delete[] data;
        }
        
        data = newDataArray;
        capacity = newCapacity;
    }
    
    memcpy(data + size, newData, newSize);
    size += newSize;
}

void FrameBuffer::Clear() {
    size = 0;
}

const BYTE* FrameBuffer::GetData() const {
    return data;
}

size_t FrameBuffer::GetSize() const {
    return size;
}
