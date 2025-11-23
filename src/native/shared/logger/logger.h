#pragma once

#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>

#ifdef _WIN32
#include <windows.h>
#endif

namespace stream_alert::logger {

enum class Stream {
    StdOut,
    StdErr
};

namespace detail {

inline std::mutex& LogMutex() {
    static std::mutex mutex;
    return mutex;
}

#ifdef _WIN32
inline void EnableAnsiColors() {
    static bool enabled = false;
    if (enabled) {
        return;
    }

    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    if (hOut == INVALID_HANDLE_VALUE) {
        enabled = true;
        return;
    }

    DWORD mode = 0;
    if (!GetConsoleMode(hOut, &mode)) {
        enabled = true;
        return;
    }

#ifdef ENABLE_VIRTUAL_TERMINAL_PROCESSING
    mode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
    SetConsoleMode(hOut, mode);
#endif
    enabled = true;
}
#else
inline void EnableAnsiColors() {}
#endif

inline std::tm LocalTime(std::time_t timeValue) {
    std::tm result{};
#ifdef _WIN32
    localtime_s(&result, &timeValue);
#else
    localtime_r(&timeValue, &result);
#endif
    return result;
}

inline std::ostream& OutputStream(Stream stream) {
    return stream == Stream::StdErr ? std::cerr : std::cout;
}

struct AnsiColor {
    static constexpr const char* Reset = "\x1b[0m";
    static constexpr const char* Time = "\x1b[38;5;100m";
    static constexpr const char* Label = "\x1b[38;5;2m";
    static constexpr const char* Message = "\x1b[38;5;7m";
};

} // namespace detail

inline void Write(Stream stream, const char* label, const std::string& message) {
    detail::EnableAnsiColors();

    const auto now = std::chrono::system_clock::now();
    const auto timeValue = std::chrono::system_clock::to_time_t(now);
    const auto milliseconds = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count() % 1000;

    const std::tm tm = detail::LocalTime(timeValue);

    std::lock_guard<std::mutex> lock(detail::LogMutex());
    auto& out = detail::OutputStream(stream);

    out << detail::AnsiColor::Time
        << "["
        << std::setfill('0') << std::setw(2) << tm.tm_hour << ":"
        << std::setfill('0') << std::setw(2) << tm.tm_min << ":"
        << std::setfill('0') << std::setw(2) << tm.tm_sec << "."
        << std::setfill('0') << std::setw(3) << milliseconds
        << "] "
        << detail::AnsiColor::Reset;

    out << detail::AnsiColor::Label
        << label << ": "
        << detail::AnsiColor::Message
        << message
        << detail::AnsiColor::Reset
        << std::endl;
}

} // namespace stream_alert::logger

#define STREAM_ALERT_LOG(stream, label, expr) \
    do { \
        std::ostringstream stream_alert_internal_oss; \
        stream_alert_internal_oss << expr; \
        ::stream_alert::logger::Write(stream, label, stream_alert_internal_oss.str()); \
    } while (0)

#define LOG_MAIN(expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdOut, "cwin", expr)
#define LOG_THREAD(expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdOut, "twin", expr)
#define LOG_LNX(expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdOut, "clnx", expr)
#define LOG_LNX_ERR(expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdErr, "elnx", expr)
#define LOG_GENERIC(label, expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdOut, label, expr)
#define LOG_GENERIC_ERR(label, expr) STREAM_ALERT_LOG(::stream_alert::logger::Stream::StdErr, label, expr)
