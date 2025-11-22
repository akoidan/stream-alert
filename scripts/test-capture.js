const fs = require('fs');
const path = require('path');
const bindings = require('bindings');

const deviceName = process.argv[2] || 'OBS Virtual Camera';
const fps = Number(process.argv[3] || 1);
const durationSeconds = Number(process.argv[4] || 10);

if (!fps || fps <= 0) {
  console.error('FPS must be a positive number.');
  process.exit(1);
}

const testDurationMs = Math.max(1, durationSeconds) * 1000;
const capture = bindings('native');

let frameCount = 0;
let lastCallbackTs = 0;
const intervals = [];
let savedPath = '';

const outputPath = path.resolve(process.cwd(), `capture-frame-${Date.now()}.bmp`);
const targetInterval = 1000 / fps;

console.log(`Starting capture on "${deviceName}" at ${fps} FPS for ${durationSeconds}s.`);
console.log('Waiting for frames...');

const shutdown = () => {
  capture.stop();
  const avgInterval = intervals.length
    ? intervals.reduce((sum, val) => sum + val, 0) / intervals.length
    : 0;
  console.log(`\nReceived ${frameCount} frames.`);
  if (intervals.length) {
    console.log(`Average interval: ${avgInterval.toFixed(2)} ms (target ${targetInterval.toFixed(2)} ms).`);
  }
  if (savedPath) {
    console.log(`First frame saved to ${savedPath}.`);
  }
  process.exit(0);
};

const timeout = setTimeout(() => {
  console.log('\nTest duration elapsed. Stopping capture...');
  shutdown();
}, testDurationMs);

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Stopping capture...');
  clearTimeout(timeout);
  shutdown();
});

capture.start(deviceName, fps, (frameData) => {
  const now = Date.now();
  frameCount += 1;

  if (lastCallbackTs) {
    intervals.push(now - lastCallbackTs);
  }
  lastCallbackTs = now;

  // frameData is now FrameData object: { buffer: Buffer, width: number, height: number }
  if (!savedPath && frameData && frameData.buffer) {
    fs.writeFileSync(outputPath, frameData.buffer);
    savedPath = outputPath;
    console.log(`Saved initial frame to ${savedPath}`);
    console.log(`Frame dimensions: ${frameData.width}x${frameData.height}`);
    console.log(`Buffer size: ${frameData.buffer.length} bytes`);
  }

  console.log(`Frame #${frameCount} (${frameData ? frameData.buffer?.length || 0 : 0} bytes, ${frameData ? `${frameData.width}x${frameData.height}` : 'N/A'})`);
});
