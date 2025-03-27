#ifndef JSON_PROCESSOR_H
#define JSON_PROCESSOR_H

#include <napi.h>
#include <simdjson.h>
#include <string>
#include <vector>
#include <unordered_map>

namespace nexurejs {
  // Forward declaration
  void AddCleanupReference(Napi::FunctionReference* ref);
}

class JsonProcessor : public Napi::ObjectWrap<JsonProcessor> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  JsonProcessor(const Napi::CallbackInfo& info);
  ~JsonProcessor();

  // Instead of using our own namespace, use simdjson::ondemand directly
  // DOM API for compatibility
  simdjson::dom::parser dom_parser_;

  // OnDemand API for performance
  simdjson::ondemand::parser ondemand_parser_;

  // Parser modes
  enum class ParserMode {
    AUTO = 0,    // Choose automatically based on document size
    DOM = 1,     // Use DOM API (slower but more compatible)
    ONDEMAND = 2 // Use OnDemand API (faster but more restrictive)
  };

private:
  // Parse methods
  Napi::Value Parse(const Napi::CallbackInfo& info);
  Napi::Value ParseBuffer(const Napi::CallbackInfo& info);
  Napi::Value ParseStream(const Napi::CallbackInfo& info);

  // Stringify methods
  Napi::Value Stringify(const Napi::CallbackInfo& info);
  Napi::Value StringifyStream(const Napi::CallbackInfo& info);

  // Configuration methods
  Napi::Value SetParserMode(const Napi::CallbackInfo& info);
  Napi::Value GetParserMode(const Napi::CallbackInfo& info);
  Napi::Value SetBufferSize(const Napi::CallbackInfo& info);
  Napi::Value GetBufferSize(const Napi::CallbackInfo& info);
  Napi::Value ReleaseBuffers(const Napi::CallbackInfo& info);

  // Helper methods for parsing
  Napi::Value ParseWithDOM(const Napi::Env& env, const std::string& json);
  Napi::Value ParseWithDOM(const Napi::Env& env, const uint8_t* data, size_t length);
  Napi::Value ParseWithOnDemand(const Napi::Env& env, const std::string& json);
  Napi::Value ParseWithOnDemand(const Napi::Env& env, const uint8_t* data, size_t length);

  // Convert simdjson DOM values to NAPI values
  Napi::Value ConvertDOMValueToNapi(const Napi::Env& env, simdjson::dom::element element);

  // Convert simdjson OnDemand values to NAPI values
  Napi::Value ConvertOnDemandValueToNapi(const Napi::Env& env, simdjson::ondemand::value value);

  // Validation helpers
  bool ValidateJson(const std::string& json);
  bool ValidateJson(const uint8_t* data, size_t length);

  // Fast stringify methods
  void StringifyValue(const Napi::Value& value, std::string& result);

  // Type-specific stringify methods
  void StringifyString(const std::string& value, std::string& result);
  void StringifyNumber(double value, std::string& result);
  void StringifyBoolean(bool value, std::string& result);

  // Object and array stringify methods
  void StringifyObjectFast(Napi::Object object, std::string& result);
  void StringifyArrayFast(Napi::Array array, std::string& result);

  // Memory management helpers
  void GrowStringBuffer(size_t newSize);
  char* GetTempBuffer(size_t size);

  // String buffers for reuse
  std::string stringBuffer_;
  std::string paddedBuffer_;

  // Temporary buffer for number formatting
  char* tempBuffer_ = nullptr;
  size_t tempBufferSize_ = 0;

  // Parser configuration
  ParserMode parserMode_ = ParserMode::AUTO;
  size_t initialStringBufferSize_ = 16 * 1024;      // 16KB initial string buffer
  size_t initialPaddedBufferSize_ = 16 * 1024;      // 16KB initial padded buffer
  static constexpr size_t maxInPlaceStringSize_ = 4 * 1024; // 4KB threshold for in-place strings

  // Miscellaneous helpers
  static Napi::Object NewInstance(Napi::Env env, Napi::Value arg);
};

#endif // JSON_PROCESSOR_H
