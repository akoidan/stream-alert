cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project (native)

add_definitions(-DNAPI_VERSION=4)

include_directories(${CMAKE_JS_INC})
include_directories(${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)


set(MAIN_SOURCE "${CMAKE_SOURCE_DIR}/src/native/main.cc")
file(GLOB_RECURSE CC_SHARED_FILES "${CMAKE_SOURCE_DIR}/src/native/shared/*.cc")

if (UNIX AND APPLE)
    message(STATUS "macOS build - not supported")
elseif (WIN32)
    message(STATUS "Windows build")
elseif (UNIX AND NOT APPLE)
    message(STATUS "Linux build")
    add_definitions(-D_LINUX)
endif()

if(WIN32)
    # Windows build

    include_directories(${CMAKE_SOURCE_DIR}/src/native/shared/headers)
    include_directories(${CMAKE_SOURCE_DIR}/src/native/win32/headers)

    file(GLOB_RECURSE CC_FILES "${CMAKE_SOURCE_DIR}/src/native/win32/*.cc")

    set(SOURCE_FILES ${CC_FILES} ${MAIN_SOURCE})
    
    add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
    set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} vfw32.lib strmiids.lib ole32.lib oleaut32.lib)
    
elseif(UNIX AND NOT APPLE)
    # Linux build
    include_directories(${CMAKE_SOURCE_DIR}/src/native/shared/headers)
    include_directories(${CMAKE_SOURCE_DIR}/src/native/linux/headers)
    
    # Find required packages
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(V4L2 REQUIRED IMPORTED_TARGET libv4l2)

    file(GLOB_RECURSE CC_FILES "${CMAKE_SOURCE_DIR}/src/native/linux/*.cc")

    set(SOURCE_FILES ${CC_FILES} ${MAIN_SOURCE})
    
    add_library(${PROJECT_NAME} ${SOURCE_FILES} ${CMAKE_JS_SRC})
    set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
    
    # Link libraries
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} PkgConfig::V4L2)
    
    # Set C++ standard
    set_property(TARGET ${PROJECT_NAME} PROPERTY CXX_STANDARD 17)
    
    # Add compiler flags
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -pthread)
    
elseif(UNIX AND APPLE)
    message(FATAL_ERROR "macOS not supported")
else()
    message(FATAL_ERROR "Unsupported OS")
endif()

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
