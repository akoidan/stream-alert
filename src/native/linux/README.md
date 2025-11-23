# Linux Native Module

This module provides video capture functionality for Linux using V4L2 (Video for Linux 2).

## Dependencies

- Linux kernel with V4L2 support
- libv4l2 (Video4Linux2 library)
- Node.js with N-API
- CMake (for building)
- C++17 compatible compiler

## Building

To build the native module, run:

```bash
yarn cmake:debug
```

## Usage

The module provides the following TypeScript interface:

```typescript
interface INativeModule {
    start(deviceName: string, frameRate: number, callback: (frameInfo: any) => void): void;
    stop(): void;
    getFrame(): FrameData | null;
    convertRgbToJpeg(rgbBuffer: Buffer, width: number, height: number): Promise<Buffer>;
    compareRgbImages(rgbBuffer1: Buffer, rgbBuffer2: Buffer, width: number, height: number, threshold: number): Promise<number>;
}

interface FrameData {
    buffer: Buffer;
    width: number;
    height: number;
    dataSize: number;
}
```

## Supported Video Formats

The module supports the following video formats (in order of preference):
1. MJPEG
2. YUYV (fallback if MJPEG is not available)

## Known Limitations

- Only supports video capture from V4L2-compatible devices
- Limited to MJPEG and YUYV formats
- No hardware acceleration for image processing

## Troubleshooting

If you encounter issues with video capture:

1. Verify that the video device exists and is accessible:
   ```bash
   ls -l /dev/video*
   ```

2. Check available formats and resolutions:
   ```bash
   v4l2-ctl --list-formats-ext -d /dev/video0
   ```

3. Ensure the current user has permission to access the video device (consider adding the user to the 'video' group)

4. Check kernel messages for V4L2-related errors:
   ```bash
   dmesg | grep -i v4l2
   ```
