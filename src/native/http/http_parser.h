#ifndef HTTP_PARSER_H
#define HTTP_PARSER_H

#include <napi.h>
#include <string>
#include <unordered_map>
#include <vector>

class HttpParser : public Napi::ObjectWrap<HttpParser> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env);
  HttpParser(const Napi::CallbackInfo& info);

private:
  // Parse methods
  Napi::Value ParseRequest(const Napi::CallbackInfo& info);
  Napi::Value ParseHeaders(const Napi::CallbackInfo& info);
  Napi::Value ParseBody(const Napi::CallbackInfo& info);
  Napi::Value ParseFormBody(const Napi::CallbackInfo& info);

  // Helper methods
  Napi::Object ParseHeadersInternal(Napi::Env env, std::string_view headersData);
  void ParseHeadersOptimized(Napi::Env env, const char* data, size_t length, Napi::Object& headers);
  Napi::Value ParseJsonBody(Napi::Env env, const char* data, size_t length);
  Napi::Value ParseFormBody(Napi::Env env, const char* data, size_t length);
  Napi::Value ParseMultipartBody(Napi::Env env, const char* data, size_t length, const std::string& boundary);
  std::string UrlDecode(std::string_view input);
  std::string UrlDecode(const char* input, size_t length);
  const char* memmem(const char* haystack, size_t haystackLen, const char* needle, size_t needleLen);

  // JavaScript accessible methods
  Napi::Value Reset(const Napi::CallbackInfo& info);

  // Internal parsing methods
  void ParseRequestLine(const char* buffer, size_t length, size_t& offset);
  void ParseHeaders(const char* buffer, size_t length, size_t& offset);
  void ParseBody(const char* buffer, size_t length, size_t& offset);

  // Parser state
  std::string method_;
  std::string url_;
  std::string httpVersion_;
  std::unordered_map<std::string, std::string> headers_;
  std::vector<char> body_;
  bool headerComplete_;
  size_t contentLength_;

  // Cached JavaScript functions
  Napi::FunctionReference jsonParseFunc_;
};

#endif // HTTP_PARSER_H
