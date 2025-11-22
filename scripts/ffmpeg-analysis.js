const { spawn } = require('child_process');
const fs = require('fs');

// Analyze FFmpeg's DirectShow usage
console.log("=== FFmpeg DirectShow Analysis ===\n");

// Test different FFmpeg configurations to see what works
const testConfigs = [
  {
    name: "Original Working Config",
    args: [
      "-f", "dshow",
      "-i", "video=OBS Virtual Camera",
      "-r", "1",
      "-vcodec", "mjpeg",
      "-f", "image2pipe",
      "-"
    ],
    duration: 5000
  },
  {
    name: "Raw Video Config", 
    args: [
      "-f", "dshow",
      "-i", "video=OBS Virtual Camera",
      "-r", "1",
      "-vcodec", "rawvideo",
      "-f", "image2pipe",
      "-"
    ],
    duration: 5000
  },
  {
    name: "Different Pixel Format",
    args: [
      "-f", "dshow", 
      "-i", "video=OBS Virtual Camera",
      "-r", "1",
      "-pix_fmt", "yuyv422",
      "-vcodec", "mjpeg",
      "-f", "image2pipe",
      "-"
    ],
    duration: 5000
  }
];

async function testConfig(config) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${config.name}`);
    console.log(`Command: ffmpeg ${config.args.join(' ')}`);
    
    const ff = spawn("ffmpeg", config.args);
    let frameCount = 0;
    let hasData = false;
    
    const timeout = setTimeout(() => {
      ff.kill();
      resolve({
        name: config.name,
        frameCount,
        hasData,
        success: frameCount > 1
      });
    }, config.duration);
    
    ff.stdout.on("data", (chunk) => {
      frameCount++;
      hasData = true;
      process.stdout.write(`.`);
    });
    
    ff.stderr.on("data", (data) => {
      const str = String(data);
      if (!str.startsWith("frame=") && !str.includes("size=")) {
        console.log(`STDERR: ${str.trim()}`);
      }
    });
    
    ff.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        name: config.name,
        frameCount,
        hasData,
        success: frameCount > 1,
        exitCode: code
      });
    });
  });
}

async function runAnalysis() {
  console.log("Testing different FFmpeg configurations...\n");
  
  for (const config of testConfigs) {
    const result = await testConfig(config);
    console.log(`\nResult: ${result.name}`);
    console.log(`  Frames: ${result.frameCount}`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Exit Code: ${result.exitCode}`);
  }
  
  console.log("\n=== Next Steps ===");
  console.log("1. Check FFmpeg source code: libavdevice/dshow.c");
  console.log("2. Compare their filter graph building approach");
  console.log("3. Analyze their media type negotiation");
  console.log("4. Check their COM initialization and threading model");
  console.log("5. Study their sample grabber implementation");
}

runAnalysis().catch(console.error);
