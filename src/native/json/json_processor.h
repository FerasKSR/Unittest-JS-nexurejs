#ifndef JSON_PROCESSOR_H
#define JSON_PROCESSOR_H

#include <napi.h>
#include <string>
#include <vector>

class JsonProcessor : public Napi::ObjectWrap<JsonProcessor> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env);
  JsonProcessor(const Napi::CallbackInfo& info);

private:
  // JavaScript accessible methods
  Napi::Value Parse(const Napi::CallbackInfo& info);
  Napi::Value Stringify(const Napi::CallbackInfo& info);
  Napi::Value ParseStream(const Napi::CallbackInfo& info);
  Napi::Value StringifyStream(const Napi::CallbackInfo& info);

  // Internal methods
  Napi::Value ParseBuffer(const char* data, size_t length);
  Napi::Value ParseString(const std::string& json);
  std::string StringifyValue(const Napi::Value& value);

  // Buffer for parsing
  std::vector<char> parseBuffer_;
};

#endif // JSON_PROCESSOR_H
