#include "json_processor.h"
#include <sstream>
#include <iomanip>
#include <cmath>
#include <cstring>
#include <simdjson.h>
#include <string>
#include <memory>
#include <vector>
#include <cinttypes>

// Initialize the JSON processor class
Napi::Object JsonProcessor::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "JsonProcessor", {
    InstanceMethod("parse", &JsonProcessor::Parse),
    InstanceMethod("stringify", &JsonProcessor::Stringify),
    InstanceMethod("parseBuffer", &JsonProcessor::ParseBuffer)
  });

  exports.Set("JsonProcessor", func);
  return exports;
}

// Create a new instance of the processor
Napi::Object JsonProcessor::NewInstance(Napi::Env env) {
  Napi::EscapableHandleScope scope(env);
  Napi::Function func = Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    return JsonProcessor::NewInstance(info.Env());
  });
  return scope.Escape(func.New({})).ToObject();
}

// Constructor
JsonProcessor::JsonProcessor(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<JsonProcessor>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Initialize simdjson parser with a larger capacity for better performance
  parser_ = std::make_unique<simdjson::dom::parser>(8 * 1024 * 1024); // 8MB initial capacity

  // Pre-allocate string buffer for better performance
  stringifyBuffer_.reserve(16 * 1024); // 16KB initial capacity
}

// Parse JSON
Napi::Value JsonProcessor::Parse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    // Get string directly without conversion
    Napi::String str = info[0].As<Napi::String>();
    std::string utf8 = str.Utf8Value();
    const char* data = utf8.c_str();
    size_t length = utf8.length();

    // Fast path for empty or very small JSON
    if (length == 0) {
      return env.Null();
    } else if (length <= 2) {
      if (utf8 == "{}") return Napi::Object::New(env);
      if (utf8 == "[]") return Napi::Array::New(env);
      if (utf8 == "null") return env.Null();
      if (utf8 == "true") return Napi::Boolean::New(env, true);
      if (utf8 == "false") return Napi::Boolean::New(env, false);
    }

    // Parse JSON using simdjson with padding for better performance
    simdjson::padded_string padded_json(data, length);
    simdjson::dom::element element = parser_->parse(padded_json);

    // Convert to NAPI value
    return ConvertSimdJsonToNapi(env, element);
  } catch (const simdjson::simdjson_error& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Stringify JSON
Napi::Value JsonProcessor::Stringify(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Value expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    // Clear the string buffer for reuse
    stringifyBuffer_.clear();

    // Pre-allocate a larger size for better performance
    stringifyBuffer_.reserve(16 * 1024); // 16KB initial capacity

    // Stringify the value
    StringifyValue(info[0], stringifyBuffer_);

    // Return the JSON string
    return Napi::String::New(env, stringifyBuffer_);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Parse JSON buffer
Napi::Value JsonProcessor::ParseBuffer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    // Get buffer directly
    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    const char* data = reinterpret_cast<const char*>(buffer.Data());
    size_t length = buffer.Length();

    // Fast path for empty or very small JSON
    if (length == 0) {
      return env.Null();
    } else if (length <= 2) {
      if (memcmp(data, "{}", 2) == 0) return Napi::Object::New(env);
      if (memcmp(data, "[]", 2) == 0) return Napi::Array::New(env);
      if (length == 4 && memcmp(data, "null", 4) == 0) return env.Null();
      if (length == 4 && memcmp(data, "true", 4) == 0) return Napi::Boolean::New(env, true);
      if (length == 5 && memcmp(data, "false", 5) == 0) return Napi::Boolean::New(env, false);
    }

    // Create a padded string for better performance
    simdjson::padded_string padded_json(data, length);

    // Parse JSON using simdjson directly from buffer
    simdjson::dom::element element = parser_->parse(padded_json);

    // Convert to NAPI value
    return ConvertSimdJsonToNapi(env, element);
  } catch (const simdjson::simdjson_error& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Helper method to convert simdjson element to NAPI value
Napi::Value JsonProcessor::ConvertSimdJsonToNapi(Napi::Env env, const simdjson::dom::element& element) {
  switch (element.type()) {
    case simdjson::dom::element_type::ARRAY: {
      simdjson::dom::array array = element.get_array();
      size_t size = array.size();
      Napi::Array result = Napi::Array::New(env, size);

      // Pre-allocate vector to avoid reallocations
      std::vector<simdjson::dom::element> elements;
      elements.reserve(size);

      // First collect all elements
      size_t index = 0;
      for (auto item : array) {
        elements.push_back(item);
      }

      // Then convert them to NAPI values
      for (const auto& item : elements) {
        result[index++] = ConvertSimdJsonToNapi(env, item);
      }

      return result;
    }

    case simdjson::dom::element_type::OBJECT: {
      simdjson::dom::object object = element.get_object();
      Napi::Object result = Napi::Object::New(env);

      // Pre-allocate vector to avoid reallocations
      std::vector<std::pair<std::string_view, simdjson::dom::element>> fields;
      fields.reserve(object.size());

      // First collect all fields
      for (auto field : object) {
        fields.emplace_back(field.key, field.value);
      }

      // Then convert them to NAPI values
      for (const auto& field : fields) {
        result.Set(
          std::string(field.first),
          ConvertSimdJsonToNapi(env, field.second)
        );
      }

      return result;
    }

    case simdjson::dom::element_type::INT64: {
      int64_t value = element.get_int64();
      return Napi::Number::New(env, static_cast<double>(value));
    }

    case simdjson::dom::element_type::UINT64: {
      uint64_t value = element.get_uint64();
      return Napi::Number::New(env, static_cast<double>(value));
    }

    case simdjson::dom::element_type::DOUBLE: {
      double value = element.get_double();
      return Napi::Number::New(env, value);
    }

    case simdjson::dom::element_type::STRING: {
      std::string_view value = element.get_string();
      return Napi::String::New(env, value.data(), value.length());
    }

    case simdjson::dom::element_type::BOOL: {
      bool value = element.get_bool();
      return Napi::Boolean::New(env, value);
    }

    case simdjson::dom::element_type::NULL_VALUE: {
      return env.Null();
    }

    default:
      return env.Undefined();
  }
}

// Helper method to stringify a value to JSON
void JsonProcessor::StringifyValue(const Napi::Value& value, std::string& result) {
  if (value.IsNull() || value.IsUndefined()) {
    result += "null";
  } else if (value.IsBoolean()) {
    bool boolValue = value.As<Napi::Boolean>().Value();
    result += boolValue ? "true" : "false";
  } else if (value.IsNumber()) {
    double numValue = value.As<Napi::Number>().DoubleValue();

    // Handle integer vs. float formatting
    if (std::floor(numValue) == numValue && numValue <= 9007199254740991.0 && numValue >= -9007199254740991.0) {
      // It's an integer within safe integer range
      // Use faster integer to string conversion
      char buffer[32];
      int len = snprintf(buffer, sizeof(buffer), "%" PRId64, static_cast<int64_t>(numValue));
      result.append(buffer, len);
    } else {
      // Format as double, ensuring we don't lose precision
      char buffer[32];
      int len = snprintf(buffer, sizeof(buffer), "%.16g", numValue);
      result.append(buffer, len);
    }
  } else if (value.IsString()) {
    std::string strValue = value.As<Napi::String>().Utf8Value();
    result += '"';

    // Escape special characters
    for (char c : strValue) {
      switch (c) {
        case '"': result += "\\\""; break;
        case '\\': result += "\\\\"; break;
        case '\b': result += "\\b"; break;
        case '\f': result += "\\f"; break;
        case '\n': result += "\\n"; break;
        case '\r': result += "\\r"; break;
        case '\t': result += "\\t"; break;
        default:
          if (static_cast<unsigned char>(c) < 32) {
            char buffer[8];
            snprintf(buffer, sizeof(buffer), "\\u%04x", static_cast<unsigned char>(c));
            result += buffer;
          } else {
            result += c;
          }
      }
    }

    result += '"';
  } else if (value.IsArray()) {
    Napi::Array array = value.As<Napi::Array>();
    result += '[';

    uint32_t length = array.Length();
    for (uint32_t i = 0; i < length; i++) {
      if (i > 0) {
        result += ',';
      }
      StringifyValue(array[i], result);
    }

    result += ']';
  } else if (value.IsObject() && !value.IsFunction() && !value.IsBuffer()) {
    Napi::Object object = value.As<Napi::Object>();
    result += '{';

    Napi::Array properties = object.GetPropertyNames();
    uint32_t length = properties.Length();

    // Pre-allocate vector for property names and values
    std::vector<std::pair<std::string, Napi::Value>> props;
    props.reserve(length);

    // First collect all properties
    for (uint32_t i = 0; i < length; i++) {
      Napi::Value key = properties[i];
      Napi::Value propertyValue = object.Get(key);

      // Skip functions
      if (!propertyValue.IsFunction()) {
        props.emplace_back(key.As<Napi::String>().Utf8Value(), propertyValue);
      }
    }

    // Then stringify them
    for (size_t i = 0; i < props.size(); i++) {
      if (i > 0) {
        result += ',';
      }

      // Add key
      result += '"';
      result += props[i].first;
      result += '"';
      result += ':';

      // Add value
      StringifyValue(props[i].second, result);
    }

    result += '}';
  } else if (value.IsBuffer()) {
    // Convert buffer to array for JSON serialization
    Napi::Buffer<uint8_t> buffer = value.As<Napi::Buffer<uint8_t>>();
    result += '[';

    // Use a faster approach for large buffers
    if (buffer.Length() > 1000) {
      // Pre-allocate a string with estimated size
      std::string bufferStr;
      bufferStr.reserve(buffer.Length() * 4); // Estimate 4 chars per byte (comma + digits)

      for (size_t i = 0; i < buffer.Length(); i++) {
        if (i > 0) {
          bufferStr += ',';
        }

        // Use faster integer to string conversion
        char numStr[8];
        int len = snprintf(numStr, sizeof(numStr), "%u", buffer.Data()[i]);
        bufferStr.append(numStr, len);
      }

      result += bufferStr;
    } else {
      // For small buffers, append directly
      for (size_t i = 0; i < buffer.Length(); i++) {
        if (i > 0) {
          result += ',';
        }

        // Use faster integer to string conversion
        char numStr[8];
        int len = snprintf(numStr, sizeof(numStr), "%u", buffer.Data()[i]);
        result.append(numStr, len);
      }
    }

    result += ']';
  } else {
    // Default for unsupported types
    result += "null";
  }
}
