#include "http_parser.h"
#include <cstring>
#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <vector>
#include <unordered_map>

// Helper function to convert string to lowercase - optimized version
inline void ToLowerCaseInPlace(std::string& str) {
  std::transform(str.begin(), str.end(), str.begin(),
                [](unsigned char c) { return std::tolower(c); });
}

// Initialize the HTTP parser class
Napi::Object HttpParser::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "HttpParser", {
    InstanceMethod("parseRequest", &HttpParser::ParseRequest),
    InstanceMethod("parseHeaders", &HttpParser::ParseHeaders),
    InstanceMethod("parseBody", &HttpParser::ParseBody)
  });

  exports.Set("HttpParser", func);
  return exports;
}

// Create a new instance of the parser
Napi::Object HttpParser::NewInstance(Napi::Env env) {
  Napi::EscapableHandleScope scope(env);
  Napi::Function func = Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    return HttpParser::NewInstance(info.Env());
  });
  return scope.Escape(func.New({})).ToObject();
}

// Constructor
HttpParser::HttpParser(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<HttpParser>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Pre-allocate memory for internal buffers
  headers_.reserve(32);
  body_.reserve(4096);

  // Cache JSON parser function for better performance
  Napi::Object global = env.Global();
  Napi::Object JSON = global.Get("JSON").As<Napi::Object>();
  jsonParseFunc_ = Napi::Reference<Napi::Function>::New(JSON.Get("parse").As<Napi::Function>(), 1);
}

// Parse HTTP request - optimized version
Napi::Value HttpParser::ParseRequest(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || (!info[0].IsString() && !info[0].IsBuffer())) {
    Napi::TypeError::New(env, "String or buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    const char* data;
    size_t length;

    // Avoid string conversion if possible by using buffer directly
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      data = buffer.Data();
      length = buffer.Length();
    } else {
      // If string is provided, get its UTF-8 representation
      std::string utf8 = info[0].As<Napi::String>().Utf8Value();
      data = utf8.c_str();
      length = utf8.length();
    }

    // Fast path for empty request
    if (length == 0) {
      Napi::Object result = Napi::Object::New(env);
      result.Set("method", env.Null());
      result.Set("path", env.Null());
      result.Set("version", env.Null());
      result.Set("headers", Napi::Object::New(env));
      result.Set("body", env.Null());
      return result;
    }

    // Pre-allocate result object
    Napi::Object result = Napi::Object::New(env);

    // Find end of request line (first CRLF)
    const char* requestLineEnd = static_cast<const char*>(memchr(data, '\n', length));
    if (!requestLineEnd) {
      // Invalid request, no LF found
      Napi::Error::New(env, "Invalid HTTP request: no LF found").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Adjust if we have CR before LF
    bool hasCR = (requestLineEnd > data && *(requestLineEnd - 1) == '\r');
    const char* actualRequestLineEnd = hasCR ? requestLineEnd - 1 : requestLineEnd;

    // Parse request line
    const char* methodEnd = static_cast<const char*>(memchr(data, ' ', actualRequestLineEnd - data));
    if (!methodEnd) {
      // Invalid request, no space after method
      Napi::Error::New(env, "Invalid HTTP request: no space after method").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Extract method
    result.Set("method", Napi::String::New(env, data, methodEnd - data));

    // Find path end (second space)
    const char* pathStart = methodEnd + 1;
    const char* pathEnd = static_cast<const char*>(memchr(pathStart, ' ', actualRequestLineEnd - pathStart));
    if (!pathEnd) {
      // Invalid request, no space after path
      Napi::Error::New(env, "Invalid HTTP request: no space after path").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Extract path
    result.Set("path", Napi::String::New(env, pathStart, pathEnd - pathStart));

    // Extract version
    const char* versionStart = pathEnd + 1;
    result.Set("version", Napi::String::New(env, versionStart, actualRequestLineEnd - versionStart));

    // Parse headers
    const char* headersStart = requestLineEnd + 1; // Skip LF
    size_t headersLength = length - (headersStart - data);

    // Create headers object
    Napi::Object headers = Napi::Object::New(env);

    // Find end of headers (double CRLF or double LF)
    const char* headersEnd = nullptr;
    const char* bodyStart = nullptr;

    // Look for \n\n
    const char* doubleLF = static_cast<const char*>(memmem(headersStart, headersLength, "\n\n", 2));
    // Look for \r\n\r\n
    const char* doubleCRLF = static_cast<const char*>(memmem(headersStart, headersLength, "\r\n\r\n", 4));

    if (doubleCRLF && (!doubleLF || doubleCRLF < doubleLF)) {
      headersEnd = doubleCRLF;
      bodyStart = doubleCRLF + 4;
    } else if (doubleLF) {
      headersEnd = doubleLF;
      bodyStart = doubleLF + 2;
    } else {
      // No double newline found, assume all remaining data is headers
      headersEnd = data + length;
      bodyStart = headersEnd;
    }

    // Parse headers if there are any
    if (headersStart < headersEnd) {
      // Use optimized header parsing
      ParseHeadersOptimized(env, headersStart, headersEnd - headersStart, headers);
    }

    result.Set("headers", headers);

    // Extract body if present
    if (bodyStart < data + length) {
      size_t bodyLength = length - (bodyStart - data);
      if (bodyLength > 0) {
        result.Set("body", Napi::String::New(env, bodyStart, bodyLength));
      } else {
        result.Set("body", env.Null());
      }
    } else {
      result.Set("body", env.Null());
    }

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Parse HTTP headers - optimized version
Napi::Value HttpParser::ParseHeaders(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || (!info[0].IsString() && !info[0].IsBuffer())) {
    Napi::TypeError::New(env, "String or buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    const char* data;
    size_t length;

    // Avoid string conversion if possible by using buffer directly
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      data = buffer.Data();
      length = buffer.Length();
    } else {
      // If string is provided, get its UTF-8 representation
      std::string utf8 = info[0].As<Napi::String>().Utf8Value();
      data = utf8.c_str();
      length = utf8.length();
    }

    // Fast path for empty headers
    if (length == 0) {
      return Napi::Object::New(env);
    }

    // Pre-allocate result object
    Napi::Object result = Napi::Object::New(env);

    // Use optimized header parsing
    ParseHeadersOptimized(env, data, length, result);

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Optimized header parsing method
void HttpParser::ParseHeadersOptimized(Napi::Env env, const char* data, size_t length, Napi::Object& headers) {
  // Pre-allocate vectors to avoid reallocations
  std::vector<std::pair<std::string, std::string>> headerPairs;
  headerPairs.reserve(32); // Most HTTP requests have fewer than 32 headers

  const char* pos = data;
  const char* end = data + length;

  // First pass: split into lines and key-value pairs
  while (pos < end) {
    // Find end of line
    const char* lineEnd = static_cast<const char*>(memchr(pos, '\n', end - pos));
    if (!lineEnd) {
      // Last line without newline
      lineEnd = end;
    }

    // Skip empty lines
    if (lineEnd == pos || (lineEnd > pos && lineEnd[-1] == '\r' && lineEnd - 1 == pos)) {
      pos = lineEnd + 1;
      continue;
    }

    // Adjust for CR if present
    const char* actualLineEnd = (lineEnd > pos && lineEnd[-1] == '\r') ? lineEnd - 1 : lineEnd;

    // Find colon
    const char* colon = static_cast<const char*>(memchr(pos, ':', actualLineEnd - pos));
    if (colon) {
      // Extract key (convert to lowercase while copying)
      std::string key(pos, colon - pos);
      ToLowerCaseInPlace(key);

      // Skip whitespace after colon
      const char* valueStart = colon + 1;
      while (valueStart < actualLineEnd && std::isspace(*valueStart)) {
        valueStart++;
      }

      // Extract value
      std::string value(valueStart, actualLineEnd - valueStart);

      // Add to header pairs
      headerPairs.emplace_back(std::move(key), std::move(value));
    }

    pos = lineEnd + 1; // Skip to next line
  }

  // Second pass: merge headers with the same name
  std::unordered_map<std::string, std::string> mergedHeaders;
  mergedHeaders.reserve(headerPairs.size());

  for (const auto& pair : headerPairs) {
    auto it = mergedHeaders.find(pair.first);
    if (it != mergedHeaders.end()) {
      // Append to existing header
      it->second += ", " + pair.second;
    } else {
      // New header
      mergedHeaders.emplace(pair.first, pair.second);
    }
  }

  // Set headers in result object
  for (const auto& pair : mergedHeaders) {
    headers.Set(pair.first, Napi::String::New(env, pair.second));
  }
}

// Helper function to find a substring in a buffer (like memmem)
const char* HttpParser::memmem(const char* haystack, size_t haystackLen, const char* needle, size_t needleLen) {
  if (needleLen > haystackLen) {
    return nullptr;
  }

  if (needleLen == 0) {
    return haystack;
  }

  // Use Boyer-Moore-Horspool algorithm for faster substring search
  size_t skip[256];
  for (size_t i = 0; i < 256; i++) {
    skip[i] = needleLen;
  }

  for (size_t i = 0; i < needleLen - 1; i++) {
    skip[(unsigned char)needle[i]] = needleLen - i - 1;
  }

  size_t i = needleLen - 1;
  while (i < haystackLen) {
    size_t j = needleLen - 1;
    while (haystack[i] == needle[j]) {
      if (j == 0) {
        return haystack + i;
      }
      i--;
      j--;
    }
    i += std::max(skip[(unsigned char)haystack[i]], needleLen - j);
  }

  return nullptr;
}

// Parse HTTP body
Napi::Value HttpParser::ParseBody(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || (!info[0].IsString() && !info[0].IsBuffer()) || !info[1].IsObject()) {
    Napi::TypeError::New(env, "String/Buffer and object expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    // Get the body
    const char* data;
    size_t length;
    std::string bodyStr;

    // Avoid string conversion if possible
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      data = buffer.Data();
      length = buffer.Length();
    } else {
      bodyStr = info[0].As<Napi::String>().Utf8Value();
      data = bodyStr.c_str();
      length = bodyStr.length();
    }

    // Get headers
    Napi::Object headers = info[1].As<Napi::Object>();

    // Get content type from headers
    std::string contentType;
    if (headers.Has("content-type")) {
      contentType = headers.Get("content-type").As<Napi::String>().Utf8Value();
    }

    // Create result object
    Napi::Object result = Napi::Object::New(env);

    // Fast path for empty body
    if (length == 0) {
      return result;
    }

    // Parse body based on content type
    if (contentType.find("application/json") != std::string::npos) {
      // Parse JSON body
      if (!jsonParseFunc_.IsEmpty()) {
        // Use cached JSON.parse function for better performance
        Napi::Value jsonValue;

        if (info[0].IsBuffer()) {
          // Convert buffer to string for JSON parsing
          Napi::String jsonStr = Napi::String::New(env, data, length);
          jsonValue = jsonParseFunc_.Value().Call({jsonStr});
        } else {
          jsonValue = jsonParseFunc_.Value().Call({info[0]});
        }

        return jsonValue;
      } else {
        // Fallback to eval
        Napi::Object global = env.Global();
        Napi::Object JSON = global.Get("JSON").As<Napi::Object>();
        Napi::Function parse = JSON.Get("parse").As<Napi::Function>();

        if (info[0].IsBuffer()) {
          // Convert buffer to string for JSON parsing
          Napi::String jsonStr = Napi::String::New(env, data, length);
          return parse.Call(JSON, {jsonStr});
        } else {
          return parse.Call(JSON, {info[0]});
        }
      }
    } else if (contentType.find("application/x-www-form-urlencoded") != std::string::npos) {
      // Parse URL-encoded form data
      return ParseFormBody(info);
    }

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Parse form body - optimized version
Napi::Value HttpParser::ParseFormBody(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Get the body
  const char* data;
  size_t length;
  std::string bodyStr;

  // Avoid string conversion if possible
  if (info[0].IsBuffer()) {
    Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
    data = buffer.Data();
    length = buffer.Length();
  } else {
    bodyStr = info[0].As<Napi::String>().Utf8Value();
    data = bodyStr.c_str();
    length = bodyStr.length();
  }

  // Create result object
  Napi::Object result = Napi::Object::New(env);

  // Fast path for empty body
  if (length == 0) {
    return result;
  }

  // Parse form data
  const char* pos = data;
  const char* end = data + length;

  while (pos < end) {
    // Find the next '&' or end of data
    const char* ampPos = static_cast<const char*>(memchr(pos, '&', end - pos));
    if (!ampPos) {
      ampPos = end;
    }

    // Find the '=' separator
    const char* equalsPos = static_cast<const char*>(memchr(pos, '=', ampPos - pos));
    if (equalsPos) {
      // Extract key and value
      std::string key(pos, equalsPos - pos);
      std::string value(equalsPos + 1, ampPos - equalsPos - 1);

      // URL decode key and value
      key = UrlDecode(key.c_str(), key.length());
      value = UrlDecode(value.c_str(), value.length());

      // Set in result object
      result.Set(key, Napi::String::New(env, value));
    } else if (ampPos > pos) {
      // Key with no value
      std::string key(pos, ampPos - pos);
      key = UrlDecode(key.c_str(), key.length());
      result.Set(key, Napi::String::New(env, ""));
    }

    pos = ampPos + 1;
  }

  return result;
}

// URL decode helper - optimized version
std::string HttpParser::UrlDecode(const char* input, size_t length) {
  std::string result;
  result.reserve(length); // Pre-allocate for better performance

  for (size_t i = 0; i < length; ++i) {
    if (input[i] == '%' && i + 2 < length) {
      // Handle percent encoding
      char hex[3] = { input[i+1], input[i+2], 0 };
      char* endptr;
      int value = strtol(hex, &endptr, 16);

      if (endptr != hex) {
        result += static_cast<char>(value);
        i += 2;
      } else {
        result += input[i];
      }
    } else if (input[i] == '+') {
      // Handle plus as space
      result += ' ';
    } else {
      // Pass through other characters
      result += input[i];
    }
  }

  return result;
}

// URL decode helper - string_view version
std::string HttpParser::UrlDecode(std::string_view input) {
  return UrlDecode(input.data(), input.length());
}
