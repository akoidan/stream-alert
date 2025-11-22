# Node.js SEA (Single Executable Application) Build

This project supports building a single executable application using Node.js SEA (Single Executable Application).

## Prerequisites

- Node.js version 24.0.0 or higher with SEA support
- Yarn package manager
- Native build tools (CMake, Visual Studio Build Tools on Windows)

## Build Process

### 1. Build the Native Module
```bash
yarn build
```
This builds the native C++ addon and places it in `build/Debug/native.node`.

### 2. Transpile TypeScript
```bash
yarn transpile
```
This compiles the TypeScript source code to JavaScript in the `dist/` folder.

### 3. Build the SEA Application
```bash
yarn build:sea
```
This command performs all the necessary steps:
- Builds the native module
- Transpiles TypeScript code
- Creates the SEA blob using `sea-config.json`
- Copies assets to `sea-assets/` folder
- Injects the blob into a copy of the Node.js executable
- Outputs `stream-alert.exe`

## Output Files

After building, you will have:

- `stream-alert.exe` - The main executable file
- `sea-assets/` - Folder containing bundled assets:
  - `native.node` - The compiled native module
  - `dist/` - The transpiled JavaScript application code

## Distribution

To distribute the application:
1. Copy `stream-alert.exe` and the entire `sea-assets/` folder to the target machine
2. Ensure both the executable and the `sea-assets/` folder are in the same directory
3. Run `stream-alert.exe`

## How It Works

### SEA Detection
The application automatically detects if it's running in a SEA context by checking for the presence of the `sea-assets/` folder next to the executable.

### Native Module Loading
- **Normal Node.js execution**: Uses the `bindings` package to locate the native module
- **SEA execution**: Loads the native module directly from `sea-assets/native.node`

### Asset Management
All application assets (JavaScript code, native modules) are bundled in the `sea-assets/` folder, allowing the executable to be self-contained while still accessing necessary files.

## Troubleshooting

### "Native module not found" Error
Ensure that:
1. The native module was built successfully (`yarn build`)
2. The `sea-assets/native.node` file exists after building
3. The `sea-assets/` folder is distributed with the executable

### SEA Build Fails
Make sure you're using Node.js 24.0.0+ with SEA support enabled. Some Node.js distributions may not include SEA support.

### Permissions Issues
On Windows, you may need to run the build command from an administrator prompt if you encounter permission errors when copying the Node.js executable.
