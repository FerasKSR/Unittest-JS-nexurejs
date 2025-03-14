#ifndef JSON_PROCESSOR_H
#define JSON_PROCESSOR_H

#include <napi.h>
#include <simdjson.h>
#include <memory>
#include <string>

namespace simdjson {
  namespace dom {
    class parser;
    class element;
  }
}

class JsonProcessor : public Napi::ObjectWrap<JsonProcessor> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env);
  JsonProcessor(const Napi::CallbackInfo& info);
  ~JsonProcessor() = default;

private:
  // JavaScript accessible methods
  Napi::Value Parse(const Napi::CallbackInfo& info);
  Napi::Value ParseBuffer(const Napi::CallbackInfo& info);
  Napi::Value Stringify(const Napi::CallbackInfo& info);

  // Helper methods
  Napi::Value ConvertSimdJsonToNapi(Napi::Env env, const simdjson::dom::element& element);
  void StringifyValue(const Napi::Value& value, std::string& result);

  // Member variables
  std::unique_ptr<simdjson::dom::parser> parser_;
  std::string stringifyBuffer_; // Reusable buffer for stringify operations
};

#endif // JSON_PROCESSOR_H
