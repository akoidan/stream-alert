const bindings = require('bindings');

// Test parameters
const deviceName = process.argv[2] || '/dev/video0';
const targetFps = Number(process.argv[3] || 2);
const testDurationSeconds = Number(process.argv[4] || 10);

if (!targetFps || targetFps <= 0) {
  console.error('FPS must be a positive number.');
  console.error('Usage: node test-framerate.js [device] [fps] [duration]');
  console.error('Example: node test-framerate.js /dev/video0 1 10');
  process.exit(1);
}

const capture = bindings('native');
const testDurationMs = testDurationSeconds * 1000;
const expectedInterval = 1000 / targetFps; // Expected milliseconds between frames

console.log('🎬 Framerate Test Starting');
console.log('========================');
console.log(`📹 Device: ${deviceName}`);
console.log(`🎯 Target FPS: ${targetFps}`);
console.log(`⏱️  Expected interval: ${expectedInterval.toFixed(2)}ms`);
console.log(`⏰ Test duration: ${testDurationSeconds}s`);
console.log('');

let frameCount = 0;
let lastFrameTime = 0;
const intervals = [];
const timestamps = [];
let startTime = 0;

// Statistics tracking
let minInterval = Infinity;
let maxInterval = 0;
let totalDeviation = 0;

const analyzeFramerate = () => {
  if (intervals.length === 0) {
    console.log('❌ No frame intervals recorded');
    return;
  }

  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const actualFps = 1000 / avgInterval;
  const fpsDeviation = Math.abs(actualFps - targetFps);
  const fpsDeviationPercent = (fpsDeviation / targetFps) * 100;

  // Calculate standard deviation
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - avgInterval, 2);
  }, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  console.log('\n📊 Framerate Analysis Results');
  console.log('=============================');
  console.log(`🎯 Target FPS: ${targetFps.toFixed(2)}`);
  console.log(`📈 Actual FPS: ${actualFps.toFixed(2)}`);
  console.log(`📉 FPS Deviation: ${fpsDeviation.toFixed(2)} (${fpsDeviationPercent.toFixed(1)}%)`);
  console.log('');
  console.log(`⏱️  Target Interval: ${expectedInterval.toFixed(2)}ms`);
  console.log(`📊 Average Interval: ${avgInterval.toFixed(2)}ms`);
  console.log(`📏 Std Deviation: ${stdDev.toFixed(2)}ms`);
  console.log(`⬇️  Min Interval: ${minInterval.toFixed(2)}ms`);
  console.log(`⬆️  Max Interval: ${maxInterval.toFixed(2)}ms`);
  console.log('');

  // Test results
  const isAccurate = fpsDeviationPercent < 10; // Within 10% is considered good
  const isStable = stdDev < (expectedInterval * 0.2); // Standard deviation < 20% of expected interval

  console.log('🧪 Test Results');
  console.log('===============');
  console.log(`${isAccurate ? '✅' : '❌'} FPS Accuracy: ${isAccurate ? 'PASS' : 'FAIL'} (${fpsDeviationPercent.toFixed(1)}% deviation)`);
  console.log(`${isStable ? '✅' : '❌'} FPS Stability: ${isStable ? 'PASS' : 'FAIL'} (${stdDev.toFixed(2)}ms std dev)`);
  
  if (frameCount > 0) {
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const overallFps = (frameCount - 1) / (totalTime / 1000);
    console.log(`📋 Overall FPS: ${overallFps.toFixed(2)} (${frameCount} frames in ${(totalTime/1000).toFixed(2)}s)`);
  }

  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('==================');
  if (!isAccurate) {
    if (actualFps > targetFps * 1.1) {
      console.log('⚠️  Frames coming too fast - check V4L2 framerate setting');
    } else if (actualFps < targetFps * 0.9) {
      console.log('⚠️  Frames coming too slow - camera may not support requested FPS');
    }
  }
  if (!isStable) {
    console.log('⚠️  Unstable framerate - check system load and camera capabilities');
  }
  if (isAccurate && isStable) {
    console.log('🎉 Framerate control is working correctly!');
  }
};

const shutdown = () => {
  console.log('\n🛑 Stopping capture...');
  capture.stop();
  analyzeFramerate();
  process.exit(0);
};

// Set up test timeout
const timeout = setTimeout(() => {
  console.log('\n⏰ Test duration completed');
  shutdown();
}, testDurationMs);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT');
  clearTimeout(timeout);
  shutdown();
});

// Start capture and frame analysis
console.log('🚀 Starting capture...\n');

capture.start(deviceName, targetFps, (frameData) => {
  const now = Date.now();
  
  if (frameCount === 0) {
    startTime = now;
    console.log('✅ First frame received, starting timing analysis...');
  }
  
  frameCount++;
  timestamps.push(now);
  
  // Calculate interval from previous frame
  if (lastFrameTime > 0) {
    const interval = now - lastFrameTime;
    intervals.push(interval);
    
    // Update statistics
    minInterval = Math.min(minInterval, interval);
    maxInterval = Math.max(maxInterval, interval);
    
    const deviation = Math.abs(interval - expectedInterval);
    totalDeviation += deviation;
    
    // Real-time feedback
    const deviationPercent = (deviation / expectedInterval) * 100;
    const status = deviationPercent < 15 ? '✅' : deviationPercent < 30 ? '⚠️' : '❌';
    
    console.log(`${status} Frame #${frameCount}: ${interval.toFixed(1)}ms (target: ${expectedInterval.toFixed(1)}ms, dev: ${deviation.toFixed(1)}ms)`);
  } else {
    console.log(`📸 Frame #${frameCount}: First frame (${frameData ? `${frameData.width}x${frameData.height}` : 'N/A'})`);
  }
  
  lastFrameTime = now;
});

console.log('⏳ Waiting for frames...');
