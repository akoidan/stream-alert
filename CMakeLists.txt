cmake_minimum_required(VERSION 3.16)
project(dshow_capture)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Node.js headers
execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

message(STATUS "Node addon API dir: ${NODE_ADDON_API_DIR}")

# Include directories
include_directories(${NODE_ADDON_API_DIR})
include_directories(${CMAKE_JS_INC})

# Add NAPI definitions
add_definitions(-DNAPI_DISABLE_CPP_EXCEPTIONS)

# Find Windows SDK automatically
find_path(WINDOWS_SDK_INCLUDE_DIR
    NAMES strmiids.h
    PATHS
    "C:/Program Files (x86)/Windows Kits/10/Include/*/um"
    "C:/Program Files/Windows Kits/10/Include/*/um"
    "C:/Program Files (x86)/Windows Kits/8.1/Include/um"
    "C:/Program Files/Windows Kits/8.1/Include/um"
    DOC "Windows SDK include directory"
)

if(WINDOWS_SDK_INCLUDE_DIR)
    message(STATUS "Found Windows SDK: ${WINDOWS_SDK_INCLUDE_DIR}")
    include_directories(${WINDOWS_SDK_INCLUDE_DIR})
    
    # Also include shared directory
    get_filename_component(SHARED_DIR ${WINDOWS_SDK_INCLUDE_DIR} DIRECTORY)
    include_directories("${SHARED_DIR}/shared")
else()
    message(WARNING "Windows SDK not found. DirectShow headers may be missing.")
endif()

# Add DirectShow specific definitions
add_definitions(-DWIN32_LEAN_AND_MEAN)
add_definitions(-DNOMINMAX)

# Source files
set(SOURCES
  src/native/simple_capture.cpp
)

# Create shared library
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${CMAKE_JS_SRC})

# Set target properties
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Link libraries
target_link_libraries(${PROJECT_NAME} 
  ${CMAKE_JS_LIB}
  vfw32.lib
)

# Windows specific settings
if(WIN32)
  target_compile_definitions(${PROJECT_NAME} PRIVATE WIN32_LEAN_AND_MEAN)
  target_compile_definitions(${PROJECT_NAME} PRIVATE NOMINMAX)
endif()
