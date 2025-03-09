#include "json_processor.h"
#include <sstream>
#include <iomanip>
#include <cmath>
#include <cstring>

// Initialize the JSON processor class
Napi::Object JsonProcessor::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "JsonProcessor", {
    InstanceMethod("parse", &JsonProcessor::Parse),
    InstanceMethod("stringify", &JsonProcessor::Stringify),
    InstanceMethod("parseStream", &JsonProcessor::ParseStream),
    InstanceMethod("stringifyStream", &JsonProcessor::StringifyStream)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("JsonProcessor", func);
  return exports;
}

// Create a new instance of the processor
Napi::Object JsonProcessor::NewInstance(Napi::Env env) {
  Napi::EscapableHandleScope scope(env);
  Napi::FunctionReference* constructor = env.GetInstanceData<Napi::FunctionReference>();
  return scope.Escape(constructor->New({})).ToObject();
}

// Constructor
JsonProcessor::JsonProcessor(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<JsonProcessor>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Pre-allocate parse buffer
  parseBuffer_.reserve(1024 * 1024); // 1MB initial capacity
}

// Parse JSON
Napi::Value JsonProcessor::Parse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected JSON string or buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  try {
    if (info[0].IsString()) {
      std::string json = info[0].As<Napi::String>().Utf8Value();
      return ParseString(json);
    } else if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      return ParseBuffer(buffer.Data(), buffer.Length());
    } else {
      Napi::TypeError::New(env, "Expected JSON string or buffer").ThrowAsJavaScriptException();
      return env.Null();
    }
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Stringify JSON
Napi::Value JsonProcessor::Stringify(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected value to stringify").ThrowAsJavaScriptException();
    return env.Null();
  }

  try {
    std::string json = StringifyValue(info[0]);
    return Napi::String::New(env, json);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Parse JSON stream
Napi::Value JsonProcessor::ParseStream(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Expected buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();

  try {
    // Append to parse buffer
    parseBuffer_.insert(parseBuffer_.end(), buffer.Data(), buffer.Data() + buffer.Length());

    // Try to parse complete JSON objects
    std::vector<Napi::Value> parsedObjects;
    size_t processedBytes = 0;

    // Simple JSON parser to find complete objects
    // This is a simplified approach - a real implementation would use a proper JSON parser
    size_t pos = 0;
    while (pos < parseBuffer_.size()) {
      // Skip whitespace
      while (pos < parseBuffer_.size() &&
             (parseBuffer_[pos] == ' ' || parseBuffer_[pos] == '\t' ||
              parseBuffer_[pos] == '\n' || parseBuffer_[pos] == '\r')) {
        pos++;
      }

      if (pos >= parseBuffer_.size()) {
        break;
      }

      // Check for object or array start
      if (parseBuffer_[pos] == '{' || parseBuffer_[pos] == '[') {
        size_t start = pos;
        size_t depth = 1;
        pos++;

        // Find matching closing bracket/brace
        bool inString = false;
        bool escaped = false;

        while (pos < parseBuffer_.size() && depth > 0) {
          char c = parseBuffer_[pos];

          if (inString) {
            if (c == '\\' && !escaped) {
              escaped = true;
            } else if (c == '"' && !escaped) {
              inString = false;
            } else {
              escaped = false;
            }
          } else {
            if (c == '"') {
              inString = true;
            } else if (c == '{' || c == '[') {
              depth++;
            } else if (c == '}' || c == ']') {
              depth--;
            }
          }

          pos++;
        }

        if (depth == 0) {
          // Complete object found
          std::string json(parseBuffer_.data() + start, pos - start);
          parsedObjects.push_back(ParseString(json));
          processedBytes = pos;
        } else {
          // Incomplete object, wait for more data
          break;
        }
      } else {
        // Invalid JSON or primitive value
        pos++;
      }
    }

    // Remove processed bytes from buffer
    if (processedBytes > 0) {
      parseBuffer_.erase(parseBuffer_.begin(), parseBuffer_.begin() + processedBytes);
    }

    // Create result array
    Napi::Array result = Napi::Array::New(env, parsedObjects.size());
    for (size_t i = 0; i < parsedObjects.size(); i++) {
      result.Set(i, parsedObjects[i]);
    }

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Stringify JSON stream
Napi::Value JsonProcessor::StringifyStream(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    Napi::TypeError::New(env, "Expected array of values").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array array = info[0].As<Napi::Array>();

  try {
    // Stringify each value
    std::string result;
    for (uint32_t i = 0; i < array.Length(); i++) {
      std::string json = StringifyValue(array.Get(i));
      result += json;

      // Add newline between objects
      if (i < array.Length() - 1) {
        result += "\n";
      }
    }

    return Napi::String::New(env, result);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Parse JSON buffer
Napi::Value JsonProcessor::ParseBuffer(const char* data, size_t length) {
  Napi::Env env = Env();

  // Skip BOM if present
  if (length >= 3 && data[0] == '\xEF' && data[1] == '\xBB' && data[2] == '\xBF') {
    data += 3;
    length -= 3;
  }

  // Skip whitespace at the beginning
  size_t start = 0;
  while (start < length &&
         (data[start] == ' ' || data[start] == '\t' ||
          data[start] == '\n' || data[start] == '\r')) {
    start++;
  }

  if (start >= length) {
    return env.Null();
  }

  // Determine the type of JSON value
  char firstChar = data[start];

  if (firstChar == '{') {
    // Parse object
    Napi::Object obj = Napi::Object::New(env);

    // Simple object parser (this is a simplified implementation)
    size_t pos = start + 1;
    bool expectKey = true;
    std::string key;

    while (pos < length) {
      // Skip whitespace
      while (pos < length &&
             (data[pos] == ' ' || data[pos] == '\t' ||
              data[pos] == '\n' || data[pos] == '\r')) {
        pos++;
      }

      if (pos >= length) {
        break;
      }

      if (data[pos] == '}') {
        // End of object
        break;
      }

      if (expectKey) {
        // Expect a key (string)
        if (data[pos] != '"') {
          throw std::runtime_error("Expected string key in object");
        }

        // Parse key
        pos++; // Skip opening quote
        size_t keyStart = pos;

        while (pos < length && data[pos] != '"') {
          if (data[pos] == '\\' && pos + 1 < length) {
            pos += 2; // Skip escape sequence
          } else {
            pos++;
          }
        }

        if (pos >= length) {
          throw std::runtime_error("Unterminated string key in object");
        }

        key = std::string(data + keyStart, pos - keyStart);
        pos++; // Skip closing quote

        // Skip whitespace
        while (pos < length &&
               (data[pos] == ' ' || data[pos] == '\t' ||
                data[pos] == '\n' || data[pos] == '\r')) {
          pos++;
        }

        if (pos >= length || data[pos] != ':') {
          throw std::runtime_error("Expected ':' after key in object");
        }

        pos++; // Skip colon
        expectKey = false;
      } else {
        // Expect a value
        // Find the end of the value
        size_t valueStart = pos;
        size_t valueEnd = pos;

        // This is a simplified approach - a real implementation would use a proper JSON parser
        if (data[pos] == '{' || data[pos] == '[') {
          // Object or array
          size_t depth = 1;
          pos++;

          while (pos < length && depth > 0) {
            if (data[pos] == '{' || data[pos] == '[') {
              depth++;
            } else if (data[pos] == '}' || data[pos] == ']') {
              depth--;
            } else if (data[pos] == '"') {
              // Skip string
              pos++;
              while (pos < length && data[pos] != '"') {
                if (data[pos] == '\\' && pos + 1 < length) {
                  pos += 2; // Skip escape sequence
                } else {
                  pos++;
                }
              }
            }

            if (depth > 0) {
              pos++;
            }
          }

          valueEnd = pos + 1;
        } else if (data[pos] == '"') {
          // String
          pos++; // Skip opening quote

          while (pos < length && data[pos] != '"') {
            if (data[pos] == '\\' && pos + 1 < length) {
              pos += 2; // Skip escape sequence
            } else {
              pos++;
            }
          }

          if (pos >= length) {
            throw std::runtime_error("Unterminated string value in object");
          }

          valueEnd = pos + 1;
          pos++; // Skip closing quote
        } else {
          // Number, boolean, or null
          while (pos < length &&
                 data[pos] != ',' && data[pos] != '}' &&
                 data[pos] != ' ' && data[pos] != '\t' &&
                 data[pos] != '\n' && data[pos] != '\r') {
            pos++;
          }

          valueEnd = pos;
        }

        // Parse the value
        std::string valueStr(data + valueStart, valueEnd - valueStart);
        Napi::Value value = ParseString(valueStr);

        // Add to object
        obj.Set(key, value);

        // Skip whitespace
        while (pos < length &&
               (data[pos] == ' ' || data[pos] == '\t' ||
                data[pos] == '\n' || data[pos] == '\r')) {
          pos++;
        }

        if (pos < length && data[pos] == ',') {
          pos++; // Skip comma
          expectKey = true;
        } else if (pos < length && data[pos] == '}') {
          // End of object
          break;
        }
      }
    }

    return obj;
  } else if (firstChar == '[') {
    // Parse array
    // This is a simplified implementation - a real implementation would use a proper JSON parser
    std::vector<Napi::Value> values;

    size_t pos = start + 1;

    while (pos < length) {
      // Skip whitespace
      while (pos < length &&
             (data[pos] == ' ' || data[pos] == '\t' ||
              data[pos] == '\n' || data[pos] == '\r')) {
        pos++;
      }

      if (pos >= length) {
        break;
      }

      if (data[pos] == ']') {
        // End of array
        break;
      }

      // Parse value
      size_t valueStart = pos;
      size_t valueEnd = pos;

      if (data[pos] == '{' || data[pos] == '[') {
        // Object or array
        size_t depth = 1;
        pos++;

        while (pos < length && depth > 0) {
          if (data[pos] == '{' || data[pos] == '[') {
            depth++;
          } else if (data[pos] == '}' || data[pos] == ']') {
            depth--;
          } else if (data[pos] == '"') {
            // Skip string
            pos++;
            while (pos < length && data[pos] != '"') {
              if (data[pos] == '\\' && pos + 1 < length) {
                pos += 2; // Skip escape sequence
              } else {
                pos++;
              }
            }
          }

          if (depth > 0) {
            pos++;
          }
        }

        valueEnd = pos + 1;
      } else if (data[pos] == '"') {
        // String
        pos++; // Skip opening quote

        while (pos < length && data[pos] != '"') {
          if (data[pos] == '\\' && pos + 1 < length) {
            pos += 2; // Skip escape sequence
          } else {
            pos++;
          }
        }

        if (pos >= length) {
          throw std::runtime_error("Unterminated string value in array");
        }

        valueEnd = pos + 1;
        pos++; // Skip closing quote
      } else {
        // Number, boolean, or null
        while (pos < length &&
               data[pos] != ',' && data[pos] != ']' &&
               data[pos] != ' ' && data[pos] != '\t' &&
               data[pos] != '\n' && data[pos] != '\r') {
          pos++;
        }

        valueEnd = pos;
      }

      // Parse the value
      std::string valueStr(data + valueStart, valueEnd - valueStart);
      values.push_back(ParseString(valueStr));

      // Skip whitespace
      while (pos < length &&
             (data[pos] == ' ' || data[pos] == '\t' ||
              data[pos] == '\n' || data[pos] == '\r')) {
        pos++;
      }

      if (pos < length && data[pos] == ',') {
        pos++; // Skip comma
      } else if (pos < length && data[pos] == ']') {
        // End of array
        break;
      }
    }

    // Create array
    Napi::Array array = Napi::Array::New(env, values.size());
    for (size_t i = 0; i < values.size(); i++) {
      array.Set(i, values[i]);
    }

    return array;
  } else if (firstChar == '"') {
    // Parse string
    size_t pos = start + 1;
    std::string value;

    while (pos < length && data[pos] != '"') {
      if (data[pos] == '\\' && pos + 1 < length) {
        // Handle escape sequences
        pos++;
        switch (data[pos]) {
          case '"': value += '"'; break;
          case '\\': value += '\\'; break;
          case '/': value += '/'; break;
          case 'b': value += '\b'; break;
          case 'f': value += '\f'; break;
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case 'u': {
            // Unicode escape sequence
            if (pos + 4 >= length) {
              throw std::runtime_error("Invalid Unicode escape sequence");
            }

            // Parse 4 hex digits
            std::string hexStr(data + pos + 1, 4);
            int codePoint = std::stoi(hexStr, nullptr, 16);

            // Convert to UTF-8
            if (codePoint < 0x80) {
              value += static_cast<char>(codePoint);
            } else if (codePoint < 0x800) {
              value += static_cast<char>(0xC0 | (codePoint >> 6));
              value += static_cast<char>(0x80 | (codePoint & 0x3F));
            } else {
              value += static_cast<char>(0xE0 | (codePoint >> 12));
              value += static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F));
              value += static_cast<char>(0x80 | (codePoint & 0x3F));
            }

            pos += 4;
            break;
          }
          default:
            value += data[pos];
            break;
        }
      } else {
        value += data[pos];
      }

      pos++;
    }

    return Napi::String::New(env, value);
  } else if (firstChar == 't') {
    // Parse true
    if (length - start >= 4 &&
        data[start] == 't' && data[start + 1] == 'r' &&
        data[start + 2] == 'u' && data[start + 3] == 'e') {
      return Napi::Boolean::New(env, true);
    }
  } else if (firstChar == 'f') {
    // Parse false
    if (length - start >= 5 &&
        data[start] == 'f' && data[start + 1] == 'a' &&
        data[start + 2] == 'l' && data[start + 3] == 's' &&
        data[start + 4] == 'e') {
      return Napi::Boolean::New(env, false);
    }
  } else if (firstChar == 'n') {
    // Parse null
    if (length - start >= 4 &&
        data[start] == 'n' && data[start + 1] == 'u' &&
        data[start + 2] == 'l' && data[start + 3] == 'l') {
      return env.Null();
    }
  } else if (firstChar == '-' || (firstChar >= '0' && firstChar <= '9')) {
    // Parse number
    size_t pos = start;
    bool isFloat = false;

    // Check for negative sign
    if (data[pos] == '-') {
      pos++;
    }

    // Parse integer part
    while (pos < length && data[pos] >= '0' && data[pos] <= '9') {
      pos++;
    }

    // Check for decimal point
    if (pos < length && data[pos] == '.') {
      isFloat = true;
      pos++;

      // Parse decimal part
      while (pos < length && data[pos] >= '0' && data[pos] <= '9') {
        pos++;
      }
    }

    // Check for exponent
    if (pos < length && (data[pos] == 'e' || data[pos] == 'E')) {
      isFloat = true;
      pos++;

      // Check for sign
      if (pos < length && (data[pos] == '+' || data[pos] == '-')) {
        pos++;
      }

      // Parse exponent
      while (pos < length && data[pos] >= '0' && data[pos] <= '9') {
        pos++;
      }
    }

    // Convert to number
    std::string numStr(data + start, pos - start);
    if (isFloat) {
      return Napi::Number::New(env, std::stod(numStr));
    } else {
      return Napi::Number::New(env, std::stoll(numStr));
    }
  }

  // Invalid JSON
  throw std::runtime_error("Invalid JSON");
}

// Parse JSON string
Napi::Value JsonProcessor::ParseString(const std::string& json) {
  return ParseBuffer(json.c_str(), json.length());
}

// Stringify a JavaScript value
std::string JsonProcessor::StringifyValue(const Napi::Value& value) {
  Napi::Env env = Env();

  if (value.IsNull() || value.IsUndefined()) {
    return "null";
  } else if (value.IsBoolean()) {
    return value.As<Napi::Boolean>().Value() ? "true" : "false";
  } else if (value.IsNumber()) {
    double num = value.As<Napi::Number>().DoubleValue();

    // Handle special cases
    if (std::isnan(num)) {
      return "null";
    } else if (std::isinf(num)) {
      return "null";
    }

    // Convert to string
    std::ostringstream ss;
    ss << std::setprecision(17) << num;
    return ss.str();
  } else if (value.IsString()) {
    std::string str = value.As<Napi::String>().Utf8Value();
    std::ostringstream ss;

    ss << '"';
    for (char c : str) {
      switch (c) {
        case '"': ss << "\\\""; break;
        case '\\': ss << "\\\\"; break;
        case '/': ss << "\\/"; break;
        case '\b': ss << "\\b"; break;
        case '\f': ss << "\\f"; break;
        case '\n': ss << "\\n"; break;
        case '\r': ss << "\\r"; break;
        case '\t': ss << "\\t"; break;
        default:
          if (static_cast<unsigned char>(c) < 0x20) {
            // Control character
            ss << "\\u" << std::hex << std::setw(4) << std::setfill('0')
               << static_cast<int>(c);
          } else {
            ss << c;
          }
          break;
      }
    }
    ss << '"';

    return ss.str();
  } else if (value.IsArray()) {
    Napi::Array array = value.As<Napi::Array>();
    std::ostringstream ss;

    ss << '[';
    for (uint32_t i = 0; i < array.Length(); i++) {
      if (i > 0) {
        ss << ',';
      }
      ss << StringifyValue(array.Get(i));
    }
    ss << ']';

    return ss.str();
  } else if (value.IsObject()) {
    Napi::Object obj = value.As<Napi::Object>();
    std::ostringstream ss;

    ss << '{';

    Napi::Array keys = obj.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
      Napi::Value key = keys.Get(i);

      // Skip non-string keys and functions
      if (!key.IsString() || obj.Get(key).IsFunction()) {
        continue;
      }

      if (i > 0) {
        ss << ',';
      }

      ss << StringifyValue(key) << ':' << StringifyValue(obj.Get(key));
    }

    ss << '}';

    return ss.str();
  } else {
    // Function, Symbol, etc.
    return "null";
  }
}
