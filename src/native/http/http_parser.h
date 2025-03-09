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
  // JavaScript accessible methods
  Napi::Value Parse(const Napi::CallbackInfo& info);
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
};

#endif // HTTP_PARSER_H
