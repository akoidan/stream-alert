cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project (native)

add_definitions(-DNAPI_VERSION=4)

include_directories(${CMAKE_JS_INC})
include_directories(${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)
include_directories(${CMAKE_SOURCE_DIR}/src/native/shared/headers)

set(MAIN_SOURCE "${CMAKE_SOURCE_DIR}/src/native/main.cc")
file(GLOB_RECURSE CC_SHARED_FILES "${CMAKE_SOURCE_DIR}/src/native/shared/*.cc")

if(WIN32)
    include_directories(${CMAKE_SOURCE_DIR}/src/native/win32/headers)
    file(GLOB_RECURSE CC_FILES "${CMAKE_SOURCE_DIR}/src/native/win32/*.cc")
    set(LIBS ${CMAKE_JS_LIB} vfw32.lib strmiids.lib ole32.lib oleaut32.lib)
elseif(UNIX AND NOT APPLE)
    include_directories(${CMAKE_SOURCE_DIR}/src/native/linux/headers)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(V4L2 REQUIRED IMPORTED_TARGET libv4l2)
    add_definitions(-D_LINUX)
    file(GLOB_RECURSE CC_FILES "${CMAKE_SOURCE_DIR}/src/native/linux/*.cc")
    set(LIBS ${CMAKE_JS_LIB} PkgConfig::V4L2)
else()
    message(FATAL_ERROR "Unsupported OS")
endif()

set(SOURCE_FILES ${CC_FILES} ${CC_SHARED_FILES} ${MAIN_SOURCE})
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
target_link_libraries(${PROJECT_NAME} ${LIBS})

if(UNIX AND NOT APPLE)
    set_property(TARGET ${PROJECT_NAME} PROPERTY CXX_STANDARD 17)
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -pthread)
endif()

set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
