#ifndef HTTP_PARSER_H
#define HTTP_PARSER_H

#include <napi.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <string_view>
#include <array>

namespace nexurejs {
  // Forward declaration
  void AddCleanupReference(Napi::FunctionReference* ref);
}

// HTTP protocol constants
constexpr size_t MAX_HEADER_SIZE = 8192; // 8KB
constexpr size_t MAX_URL_LENGTH = 8192; // 8KB
constexpr size_t MAX_METHOD_LENGTH = 32;
constexpr size_t MAX_VERSION_LENGTH = 8;
constexpr size_t MAX_HEADER_COUNT = 100;
constexpr size_t MAX_HEADER_NAME_LENGTH = 256;
constexpr size_t MAX_HEADER_VALUE_LENGTH = 8192; // 8KB

// Common HTTP header names
const std::string_view HEADER_CONTENT_LENGTH = "content-length";
const std::string_view HEADER_CONTENT_TYPE = "content-type";
const std::string_view HEADER_CONNECTION = "connection";
const std::string_view HEADER_TRANSFER_ENCODING = "transfer-encoding";
const std::string_view HEADER_HOST = "host";
const std::string_view HEADER_ACCEPT = "accept";
const std::string_view HEADER_USER_AGENT = "user-agent";
const std::string_view HEADER_COOKIE = "cookie";
const std::string_view HEADER_AUTHORIZATION = "authorization";
const std::string_view HEADER_ACCEPT_ENCODING = "accept-encoding";
const std::string_view HEADER_ACCEPT_LANGUAGE = "accept-language";
const std::string_view HEADER_CACHE_CONTROL = "cache-control";
const std::string_view HEADER_ORIGIN = "origin";
const std::string_view HEADER_REFERER = "referer";
const std::string_view HEADER_IF_NONE_MATCH = "if-none-match";
const std::string_view HEADER_IF_MODIFIED_SINCE = "if-modified-since";
const std::string_view HEADER_X_REQUESTED_WITH = "x-requested-with";
const std::string_view HEADER_X_FORWARDED_FOR = "x-forwarded-for";
const std::string_view HEADER_X_FORWARDED_PROTO = "x-forwarded-proto";
const std::string_view HEADER_X_FORWARDED_HOST = "x-forwarded-host";

// HTTP protocol constants
const std::string_view CRLF = "\r\n";
const std::string_view COLON_SPACE = ": ";
const std::string_view DOUBLE_CRLF = "\r\n\r\n";
const std::string_view SPACE = " ";
const std::string_view HTTP_VERSION_PREFIX = "HTTP/";

class HttpParser : public Napi::ObjectWrap<HttpParser> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  HttpParser(const Napi::CallbackInfo& info);

  // Main methods
  Napi::Value ParseRequest(const Napi::CallbackInfo& info);
  Napi::Value ParseHeaders(const Napi::CallbackInfo& info);
  Napi::Value ParseBody(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);

private:
  // Internal parsing methods
  bool ParseRequestLine(Napi::Env env, Napi::Object result);
  bool ParseHeaders(Napi::Env env, Napi::Object headers);
  void Reset();

  // Helper methods
  Napi::Buffer<char> GetBuffer(Napi::Env env, size_t size);
  void ReleaseBuffer(Napi::Buffer<char> buffer);
  Napi::Object GetHeadersObject(Napi::Env env);
  void ReleaseHeadersObject(Napi::Object headersObj);
  std::string_view CreateStringView(size_t start, size_t length);
  std::string_view CreateStringView(size_t start);
  const char* FindSubstring(const char* haystack, size_t haystackLen,
                        const char* needle, size_t needleLen);
  std::string UrlDecode(const std::string_view& input);
  std::string NormalizeHeaderName(const std::string& name);

  // New methods for optimized header normalization
  void InitializeLowercaseMap();
  std::string ToLowercase(const std::string_view& input) const;

  // New zero-copy methods
  std::string_view GetHeaderValueView(const std::string& name) const;
  bool CaseInsensitiveCompare(const std::string& a, const std::string& b) const;

  // Object pool reference
  Napi::Reference<Napi::Object> objectPool_;
  bool useObjectPool_ = false;

  // Parser state
  bool headerComplete_ = false;
  bool isComplete_ = false;
  bool upgrade_ = false;
  bool chunkedEncoding_ = false;
  size_t contentLength_ = 0;

  // Buffer state
  const char* currentBuffer_ = nullptr;
  size_t bufferLength_ = 0;
  size_t bufferOffset_ = 0;
  size_t bodyOffset_ = 0;
  size_t headerEndOffset_ = 0;

  // Reference to the current buffer to prevent GC
  Napi::Reference<Napi::Buffer<char>> bufferRef_;

  // Storage vectors
  std::unordered_map<std::string, std::string> headers_;
  std::vector<char> body_;

  // Cache of normalized header names
  std::unordered_map<std::string, std::string> headerNames_;

  // Lookup table for lowercase conversion (ASCII optimization)
  std::array<char, 256> lowercaseMap_;
};

#endif // HTTP_PARSER_H
