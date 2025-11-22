const fs = require('fs');
const path = require('path');
const bindings = require('bindings');

const deviceName = process.argv[2] || 'OBS Virtual Camera';
const fps = Number(process.argv[3] || 1);
const durationSeconds = Number(process.argv[4] || 5);

if (!fps || fps <= 0) {
  console.error('FPS must be a positive number.');
  process.exit(1);
}

const testDurationMs = Math.max(1, durationSeconds) * 1000;
const capture = bindings('native');

let frameCount = 0;
let lastCallbackTs = 0;
const intervals = [];
let savedFrame = null;

const outputPath = path.resolve(process.cwd(), `capture-frame-${Date.now()}.jpg`);
const targetInterval = 1000 / fps;

console.log(`Starting capture on "${deviceName}" at ${fps} FPS for ${durationSeconds}s.`);
console.log('Waiting for frames...');

// Add setInterval to demonstrate non-blocking behavior
let heartbeatCount = 0;
let heartbeatInterval = null;


const shutdown = async () => {
  capture.stop();
  const avgInterval = intervals.length
    ? intervals.reduce((sum, val) => sum + val, 0) / intervals.length
    : 0;
  console.log(`\nReceived ${frameCount} frames.`);
  if (intervals.length) {
    console.log(`Average interval: ${avgInterval.toFixed(2)} ms (target ${targetInterval.toFixed(2)} ms).`);
  }
  
  // Convert saved RGB frame to JPEG if we have one
  if (savedFrame && savedFrame.buffer) {
    console.log(`Converting last RGB frame to JPEG...`);
    try {
      heartbeatInterval = setInterval(() => {
        heartbeatCount++;
        process.stdout.write(',')
      }, 50);
      const jpegBuffer = await capture.convertRgbToJpeg(savedFrame.buffer, savedFrame.width, savedFrame.height);
      fs.writeFileSync(outputPath, jpegBuffer);
      console.log(`✅ Last RGB frame converted and saved to ${outputPath}`);
      console.log(`📊 Original RGB: ${savedFrame.buffer.length} bytes, JPEG: ${jpegBuffer.length} bytes`);
      console.log(`📐 Frame dimensions: ${savedFrame.width}x${savedFrame.height}`);
    } catch (error) {
      console.error(`❌ Failed to convert RGB to JPEG: ${error.message}`);
    }
  } else {
    console.log(`No frame data to convert.`);
  }
  
  // Clear the heartbeat interval
  clearInterval(heartbeatInterval);
  console.log(`\n🛑 Main thread heartbeat stopped after ${heartbeatCount} beats.`);
  
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

  
  // Always save the current frame as the "last" frame for JPEG conversion
  if (frameData && frameData.buffer) {
    savedFrame = frameData;
    if (frameCount === 1) {
      console.log(`✅ Captured first RGB frame`);
    }
  }

  console.log(`Frame #${frameCount} (${frameData ? frameData.buffer?.length || 0 : 0} bytes, ${frameData ? `${frameData.width}x${frameData.height}` : 'N/A'})`);
});
