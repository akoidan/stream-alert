cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project (native)

add_definitions(-DNAPI_VERSION=4)

include_directories(${CMAKE_JS_INC})
include_directories(${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)

if (UNIX AND APPLE)
    message(STATUS "macOS build - not supported")
elseif (WIN32)
    message(STATUS "Windows build")
elseif (UNIX AND NOT APPLE)
    message(STATUS "Linux build - not supported")
endif()

if(WIN32)
    file(GLOB_RECURSE HEADERS "${CMAKE_SOURCE_DIR}/src/native/win32/headers/**.h")
    file(GLOB_RECURSE SOURCES "${CMAKE_SOURCE_DIR}/src/native/win32/**.cc")
    set(SOURCE_FILES ${SOURCES} ${HEADERS})
elseif(UNIX AND NOT APPLE)
    message(FATAL_ERROR "Linux not supported")
elseif(UNIX AND APPLE)
    message(FATAL_ERROR "macOS not supported")
else()
    message(FATAL_ERROR "Unsupported OS")
endif()

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

if(WIN32)
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} vfw32.lib)
elseif(UNIX)
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
endif()

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
