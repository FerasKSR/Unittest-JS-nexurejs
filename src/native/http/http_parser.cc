#include "http_parser.h"
#include <cstring>
#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <vector>
#include <unordered_map>

// Helper function to convert string to lowercase - optimized version
inline std::string ToLowerCase(const std::string& str) {
  std::string result;
  result.reserve(str.length()); // Pre-allocate memory
  std::transform(str.begin(), str.end(), std::back_inserter(result),
                [](unsigned char c) { return std::tolower(c); });
  return result;
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

// Parse HTTP request
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

    // Use a persistent buffer to avoid string conversion
    std::string utf8;

    // Avoid string conversion if possible
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      data = buffer.Data();
      length = buffer.Length();
    } else {
      Napi::String str = info[0].As<Napi::String>();
      utf8 = str.Utf8Value();
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
    const char* requestLineEnd = static_cast<const char*>(memmem(data, length, "\r\n", 2));
    if (!requestLineEnd) {
      // Invalid request, no CRLF found
      Napi::Error::New(env, "Invalid HTTP request: no CRLF found").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Parse request line
    const char* methodEnd = static_cast<const char*>(memchr(data, ' ', requestLineEnd - data));
    if (!methodEnd) {
      // Invalid request, no space after method
      Napi::Error::New(env, "Invalid HTTP request: no space after method").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Extract method
    std::string method(data, methodEnd - data);
    result.Set("method", Napi::String::New(env, method));

    // Find path end (second space)
    const char* pathStart = methodEnd + 1;
    const char* pathEnd = static_cast<const char*>(memchr(pathStart, ' ', requestLineEnd - pathStart));
    if (!pathEnd) {
      // Invalid request, no space after path
      Napi::Error::New(env, "Invalid HTTP request: no space after path").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Extract path
    std::string path(pathStart, pathEnd - pathStart);
    result.Set("path", Napi::String::New(env, path));

    // Extract version
    const char* versionStart = pathEnd + 1;
    std::string version(versionStart, requestLineEnd - versionStart);
    result.Set("version", Napi::String::New(env, version));

    // Parse headers
    const char* headersStart = requestLineEnd + 2; // Skip CRLF
    const char* headersEnd = static_cast<const char*>(memmem(headersStart, length - (headersStart - data), "\r\n\r\n", 4));

    // If no double CRLF found, assume all remaining data is headers
    if (!headersEnd) {
      headersEnd = data + length;
    }

    // Extract headers
    size_t headersLength = headersEnd - headersStart;

    // Create headers object
    Napi::Object headers = Napi::Object::New(env);

    // Parse headers if there are any
    if (headersLength > 0) {
      // Pre-allocate vectors for header fields
      std::vector<std::pair<std::string, std::string>> headerFields;
      headerFields.reserve(20); // Most HTTP requests have fewer than 20 headers

      const char* pos = headersStart;
      const char* end = headersEnd;

      // Collect all header fields
      while (pos < end) {
        // Find end of line
        const char* lineEnd = static_cast<const char*>(memmem(pos, end - pos, "\r\n", 2));
        if (!lineEnd) {
          lineEnd = end;
        }

        // Skip empty lines
        if (lineEnd == pos) {
          pos = lineEnd + 2; // Skip CRLF
          continue;
        }

        // Find colon
        const char* colonPos = static_cast<const char*>(memchr(pos, ':', lineEnd - pos));
        if (colonPos) {
          // Extract key and value
          std::string key(pos, colonPos - pos);

          // Skip colon and whitespace
          const char* valueStart = colonPos + 1;
          while (valueStart < lineEnd && std::isspace(*valueStart)) {
            valueStart++;
          }

          // Determine value end (excluding trailing whitespace and CR)
          const char* valueEnd = lineEnd;
          while (valueEnd > valueStart && (std::isspace(*(valueEnd - 1)) || *(valueEnd - 1) == '\r')) {
            valueEnd--;
          }

          std::string value(valueStart, valueEnd - valueStart);

          // Convert key to lowercase for case-insensitive comparison
          for (char& c : key) {
            c = std::tolower(c);
          }

          headerFields.emplace_back(std::move(key), std::move(value));
        }

        pos = lineEnd + 2; // Skip CRLF
      }

      // Set header fields in headers object
      for (const auto& field : headerFields) {
        headers.Set(field.first, Napi::String::New(env, field.second));
      }
    }

    result.Set("headers", headers);

    // Extract body if present
    if (headersEnd + 4 <= data + length) {
      const char* bodyStart = headersEnd + 4; // Skip double CRLF
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

// Parse HTTP headers
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

    // Use a persistent buffer to avoid string conversion
    std::string utf8;

    // Avoid string conversion if possible
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      data = buffer.Data();
      length = buffer.Length();
    } else {
      Napi::String str = info[0].As<Napi::String>();
      utf8 = str.Utf8Value();
      data = utf8.c_str();
      length = utf8.length();
    }

    // Fast path for empty headers
    if (length == 0) {
      return Napi::Object::New(env);
    }

    // Pre-allocate result object
    Napi::Object result = Napi::Object::New(env);

    // Pre-allocate vectors for header fields
    std::vector<std::pair<std::string, std::string>> headerFields;
    headerFields.reserve(20); // Most HTTP requests have fewer than 20 headers

    const char* pos = data;
    const char* end = data + length;

    // Fast path for single line
    if (memchr(data, '\n', length) == nullptr) {
      // No newlines, just return empty object
      return result;
    }

    // First pass: collect all header fields
    while (pos < end) {
      // Find end of line
      const char* lineEnd = static_cast<const char*>(memchr(pos, '\n', end - pos));
      if (!lineEnd) {
        lineEnd = end;
      }

      // Skip empty lines
      if (lineEnd == pos || (lineEnd == pos + 1 && pos[0] == '\r')) {
        pos = lineEnd + 1;
        continue;
      }

      // Find colon
      const char* colonPos = static_cast<const char*>(memchr(pos, ':', lineEnd - pos));
      if (colonPos) {
        // Extract key and value
        std::string key(pos, colonPos - pos);

        // Skip colon and whitespace
        const char* valueStart = colonPos + 1;
        while (valueStart < lineEnd && std::isspace(*valueStart)) {
          valueStart++;
        }

        // Determine value end (excluding trailing whitespace and CR)
        const char* valueEnd = lineEnd;
        while (valueEnd > valueStart && (std::isspace(*(valueEnd - 1)) || *(valueEnd - 1) == '\r')) {
          valueEnd--;
        }

        std::string value(valueStart, valueEnd - valueStart);

        // Convert key to lowercase for case-insensitive comparison
        for (char& c : key) {
          c = std::tolower(c);
        }

        headerFields.emplace_back(std::move(key), std::move(value));
      }

      pos = lineEnd + 1;
    }

    // Second pass: set header fields in result object
    for (const auto& field : headerFields) {
      result.Set(field.first, Napi::String::New(env, field.second));
    }

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
    const char* lineEnd = static_cast<const char*>(memchr(pos, '\r', end - pos));
    if (!lineEnd || lineEnd + 1 >= end || lineEnd[1] != '\n') {
      break;
    }

    // Skip empty lines
    if (lineEnd == pos) {
      pos = lineEnd + 2; // Skip \r\n
      continue;
    }

    // Find colon
    const char* colon = static_cast<const char*>(memchr(pos, ':', lineEnd - pos));
    if (colon) {
      // Extract key (convert to lowercase while copying)
      std::string key;
      key.reserve(colon - pos);
      for (const char* p = pos; p < colon; p++) {
        key.push_back(std::tolower(*p));
      }

      // Skip whitespace after colon
      const char* valueStart = colon + 1;
      while (valueStart < lineEnd && std::isspace(*valueStart)) {
        valueStart++;
      }

      // Extract value
      std::string value(valueStart, lineEnd - valueStart);

      // Add to header pairs
      headerPairs.emplace_back(std::move(key), std::move(value));
    }

    pos = lineEnd + 2; // Skip \r\n
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

Napi::Object HttpParser::ParseHeadersInternal(Napi::Env env, std::string_view headersData) {
  Napi::Object headers = Napi::Object::New(env);
  ParseHeadersOptimized(env, headersData.data(), headersData.length(), headers);
  return headers;
}

// Parse HTTP body
Napi::Value HttpParser::ParseBody(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsObject()) {
    Napi::TypeError::New(env, "String and object expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  try {
    // Get the body and headers
    std::string body = info[0].As<Napi::String>().Utf8Value();
    Napi::Object headers = info[1].As<Napi::Object>();

    // Get content type from headers
    std::string contentType;
    if (headers.Has("content-type")) {
      contentType = headers.Get("content-type").As<Napi::String>().Utf8Value();
    }

    // Create result object
    Napi::Object result = Napi::Object::New(env);

    // Fast path for empty body
    if (body.empty()) {
      return result;
    }

    // Parse body based on content type
    if (contentType.find("application/json") != std::string::npos) {
      // Parse JSON body
      if (!jsonParseFunc_.IsEmpty()) {
        // Use cached JSON.parse function
        Napi::Value jsonValue = jsonParseFunc_.Value().Call({Napi::String::New(env, body)});
        return jsonValue;
      } else {
        // Fallback to eval
        Napi::Object global = env.Global();
        Napi::Object JSON = global.Get("JSON").As<Napi::Object>();
        Napi::Function parse = JSON.Get("parse").As<Napi::Function>();
        return parse.Call(JSON, {Napi::String::New(env, body)});
      }
    } else if (contentType.find("application/x-www-form-urlencoded") != std::string::npos) {
      // Parse URL-encoded form data
      return ParseFormBody(info);
    } else if (contentType.find("multipart/form-data") != std::string::npos) {
      // Parse multipart form data
      std::string boundary;
      size_t boundaryPos = contentType.find("boundary=");
      if (boundaryPos != std::string::npos) {
        boundary = contentType.substr(boundaryPos + 9);
        // Remove quotes if present
        if (boundary.front() == '"' && boundary.back() == '"') {
          boundary = boundary.substr(1, boundary.length() - 2);
        }
      }

      if (!boundary.empty()) {
        // Create boundary markers
        std::string boundaryMarker = "--" + boundary;
        std::string endBoundaryMarker = "--" + boundary + "--";

        // Split body by boundary
        size_t pos = 0;
        size_t nextPos = body.find(boundaryMarker);

        while (nextPos != std::string::npos) {
          // Move past the boundary
          pos = nextPos + boundaryMarker.length();

          // Check if this is the end boundary
          if (body.compare(nextPos, endBoundaryMarker.length(), endBoundaryMarker) == 0) {
            break;
          }

          // Find the next boundary
          nextPos = body.find(boundaryMarker, pos);
          if (nextPos == std::string::npos) {
            break;
          }

          // Extract the part between boundaries
          std::string part = body.substr(pos, nextPos - pos);

          // Find the end of headers (double newline)
          size_t headersEnd = part.find("\r\n\r\n");
          if (headersEnd != std::string::npos) {
            // Extract headers and content
            std::string headers = part.substr(0, headersEnd);
            std::string content = part.substr(headersEnd + 4);

            // Parse the headers to find name and filename
            std::string name;
            std::string filename;

            // Find Content-Disposition header
            size_t cdPos = headers.find("Content-Disposition:");
            if (cdPos != std::string::npos) {
              // Find name parameter
              size_t namePos = headers.find("name=\"", cdPos);
              if (namePos != std::string::npos) {
                namePos += 6; // Move past 'name="'
                size_t nameEnd = headers.find("\"", namePos);
                if (nameEnd != std::string::npos) {
                  name = headers.substr(namePos, nameEnd - namePos);
                }
              }

              // Find filename parameter
              size_t filenamePos = headers.find("filename=\"", cdPos);
              if (filenamePos != std::string::npos) {
                filenamePos += 10; // Move past 'filename="'
                size_t filenameEnd = headers.find("\"", filenamePos);
                if (filenameEnd != std::string::npos) {
                  filename = headers.substr(filenamePos, filenameEnd - filenamePos);
                }
              }
            }

            // Add to result if we have a name
            if (!name.empty()) {
              if (!filename.empty()) {
                // File upload
                Napi::Object fileObj = Napi::Object::New(env);
                fileObj.Set("filename", Napi::String::New(env, filename));
                fileObj.Set("data", Napi::String::New(env, content));
                result.Set(name, fileObj);
              } else {
                // Regular field
                result.Set(name, Napi::String::New(env, content));
              }
            }
          }
        }
      }
    }

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Parse form body
Napi::Value HttpParser::ParseFormBody(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Get the body
  std::string body = info[0].As<Napi::String>().Utf8Value();

  // Create result object
  Napi::Object result = Napi::Object::New(env);

  // Fast path for empty body
  if (body.empty()) {
    return result;
  }

  // Pre-allocate vectors for better performance
  std::vector<std::string> pairs;
  pairs.reserve(16); // Assume up to 16 form fields

  // Split by &
  size_t start = 0;
  size_t end = body.find('&');

  while (end != std::string::npos) {
    pairs.push_back(body.substr(start, end - start));
    start = end + 1;
    end = body.find('&', start);
  }

  // Add the last pair
  pairs.push_back(body.substr(start));

  // Process each pair
  for (const auto& pair : pairs) {
    size_t equalsPos = pair.find('=');
    if (equalsPos != std::string::npos) {
      std::string key = pair.substr(0, equalsPos);
      std::string value = pair.substr(equalsPos + 1);

      // URL decode key and value
      key = UrlDecode(key);
      value = UrlDecode(value);

      // Set in result object
      result.Set(key, Napi::String::New(env, value));
    }
  }

  return result;
}

// URL decode helper
std::string HttpParser::UrlDecode(std::string_view input) {
  std::string result;
  result.reserve(input.size()); // Pre-allocate for better performance

  for (size_t i = 0; i < input.size(); ++i) {
    if (input[i] == '%' && i + 2 < input.size()) {
      // Handle percent encoding
      int value = 0;
      if (sscanf(input.data() + i + 1, "%2x", &value) == 1) {
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

// Helper function to find a substring in a buffer (like memmem)
const char* HttpParser::memmem(const char* haystack, size_t haystackLen, const char* needle, size_t needleLen) {
  if (needleLen > haystackLen) {
    return nullptr;
  }

  if (needleLen == 0) {
    return haystack;
  }

  const char* end = haystack + haystackLen - needleLen + 1;
  for (const char* p = haystack; p < end; p++) {
    if (p[0] == needle[0] && memcmp(p, needle, needleLen) == 0) {
      return p;
    }
  }

  return nullptr;
}
