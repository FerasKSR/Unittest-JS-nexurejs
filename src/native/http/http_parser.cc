#include "http_parser.h"
#include <algorithm>
#include <cctype>
#include <sstream>
#include <string_view>
#include <array>

// Initialize static constants and helpers
Napi::Object HttpParser::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "HttpParser", {
    InstanceMethod("parseRequest", &HttpParser::ParseRequest),
    InstanceMethod("parseHeaders", &HttpParser::ParseHeaders),
    InstanceMethod("parseBody", &HttpParser::ParseBody),
    InstanceMethod("reset", &HttpParser::Reset)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  exports.Set("HttpParser", func);

  // Add to cleanup list
  nexurejs::AddCleanupReference(constructor);

  return exports;
}

// Constructor
HttpParser::HttpParser(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<HttpParser>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Pre-allocate vectors to reduce allocations
  headers_.reserve(32);
  body_.reserve(4096);

  // Initialize header names map with common headers for quick comparison
  headerNames_ = {
    {"host", "Host"},
    {"content-type", "Content-Type"},
    {"content-length", "Content-Length"},
    {"user-agent", "User-Agent"},
    {"accept", "Accept"},
    {"connection", "Connection"},
    {"cookie", "Cookie"},
    {"authorization", "Authorization"},
    {"accept-encoding", "Accept-Encoding"},
    {"accept-language", "Accept-Language"},
    {"cache-control", "Cache-Control"},
    {"origin", "Origin"},
    {"referer", "Referer"},
    {"if-none-match", "If-None-Match"},
    {"if-modified-since", "If-Modified-Since"},
    {"x-requested-with", "X-Requested-With"},
    {"x-forwarded-for", "X-Forwarded-For"},
    {"x-forwarded-proto", "X-Forwarded-Proto"},
    {"x-forwarded-host", "X-Forwarded-Host"}
  };

  // Initialize lowercase map for case-insensitive comparison
  InitializeLowercaseMap();

  // Check if we are passed an object pool instance
  if (info.Length() > 0 && info[0].IsObject()) {
    objectPool_ = Napi::Reference<Napi::Object>::New(info[0].As<Napi::Object>(), 1);
    useObjectPool_ = true;
  } else {
    useObjectPool_ = false;
  }

  // Reset parser state
  Reset();
}

// Initialize a lookup table for faster case conversion
void HttpParser::InitializeLowercaseMap() {
  // Initialize the lowercase conversion lookup table
  for (int i = 0; i < 256; i++) {
    lowercaseMap_[i] = i;
  }

  // Set lowercase mappings for uppercase ASCII characters
  for (int i = 'A'; i <= 'Z'; i++) {
    lowercaseMap_[i] = i + 32;
  }
}

// Case insensitive string comparison using lookup table
bool HttpParser::CaseInsensitiveCompare(const std::string& a, const std::string& b) const {
  if (a.length() != b.length()) {
    return false;
  }

  for (size_t i = 0; i < a.length(); i++) {
    if (lowercaseMap_[static_cast<unsigned char>(a[i])] !=
        lowercaseMap_[static_cast<unsigned char>(b[i])]) {
      return false;
    }
  }

  return true;
}

// Fast lowercase conversion using lookup table
std::string HttpParser::ToLowercase(const std::string_view& input) const {
  std::string result;
  result.reserve(input.length());

  for (char c : input) {
    result.push_back(lowercaseMap_[static_cast<unsigned char>(c)]);
  }

  return result;
}

// Reset parser state
void HttpParser::Reset() {
  headers_.clear();
  body_.clear();

  // Reset parser state
  headerComplete_ = false;
  contentLength_ = 0;

  // Reset buffer state
  currentBuffer_ = nullptr;
  bufferLength_ = 0;
  bufferOffset_ = 0;
  bodyOffset_ = 0;
  headerEndOffset_ = 0;
  isComplete_ = false;
  upgrade_ = false;
  chunkedEncoding_ = false;
}

// Main request parsing method
Napi::Value HttpParser::ParseRequest(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Check arguments
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get the buffer
  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();

  // Store the buffer for later use and reset state
  currentBuffer_ = buffer.Data();
  bufferLength_ = buffer.Length();
  bufferOffset_ = 0;
  bodyOffset_ = 0;
  headerEndOffset_ = 0;

  // Store the buffer reference to prevent GC
  if (!bufferRef_.IsEmpty()) {
    bufferRef_.Unref();
  }
  bufferRef_ = Napi::Persistent(buffer);

  // Create the result object
  Napi::Object result = Napi::Object::New(env);

  // Parse the request line
  try {
    if (!ParseRequestLine(env, result)) {
      Napi::Error::New(env, "Failed to parse request line").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Parse the headers
    Napi::Object headers = GetHeadersObject(env);
    if (!ParseHeaders(env, headers)) {
      ReleaseHeadersObject(headers);
      Napi::Error::New(env, "Failed to parse headers").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Add headers to result
    result.Set("headers", headers);

    // Check for upgrade
    if (headers.Has("connection")) {
      std::string_view connection = GetHeaderValueView("connection");
      upgrade_ = (connection == "upgrade" || connection == "Upgrade");
    }
    result.Set("upgrade", Napi::Boolean::New(env, upgrade_));

    // Check for content-length
    if (headers.Has("content-length")) {
      std::string_view contentLengthStr = GetHeaderValueView("content-length");
      contentLength_ = std::stoi(std::string(contentLengthStr));
    }

    // Check for chunked encoding
    if (headers.Has("transfer-encoding")) {
      std::string_view transferEncoding = GetHeaderValueView("transfer-encoding");
      chunkedEncoding_ = (transferEncoding == "chunked" || transferEncoding == "Chunked");
    }

    // Set body to null for now - client code will call parseBody if needed
    result.Set("body", env.Null());
    result.Set("complete", Napi::Boolean::New(env, isComplete_));

    // Set raw buffer information for zero-copy access from JS
    if (headerEndOffset_ > 0) {
      Napi::Object rawInfo = Napi::Object::New(env);
      rawInfo.Set("buffer", buffer);
      rawInfo.Set("headerEnd", Napi::Number::New(env, headerEndOffset_));
      rawInfo.Set("bodyStart", Napi::Number::New(env, bodyOffset_));
      result.Set("_rawBufferInfo", rawInfo);
    }

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Parse headers from buffer
Napi::Value HttpParser::ParseHeaders(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get the buffer
  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();

  // Store the buffer for later use
  currentBuffer_ = buffer.Data();
  bufferLength_ = buffer.Length();
  bufferOffset_ = 0;

  // Create headers object
  Napi::Object headers = GetHeadersObject(env);

  // Parse headers
  if (!ParseHeaders(env, headers)) {
    ReleaseHeadersObject(headers);
    Napi::Error::New(env, "Failed to parse headers").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return headers;
}

// Parse body from buffer
Napi::Value HttpParser::ParseBody(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get the buffer
  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();

  // Store the buffer for later use
  currentBuffer_ = buffer.Data();
  bufferLength_ = buffer.Length();
  bufferOffset_ = 0;

  // Get content length from options if provided
  size_t length = 0;
  if (info.Length() >= 2 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    if (options.Has("contentLength") && options.Get("contentLength").IsNumber()) {
      length = options.Get("contentLength").As<Napi::Number>().Uint32Value();
    }
  }

  // If no content length or invalid, use the whole buffer
  if (length == 0) {
    length = bufferLength_;
  }

  // Create buffer with the body content
  Napi::Buffer<char> body = GetBuffer(env, length);
  memcpy(body.Data(), currentBuffer_, std::min(length, bufferLength_));

  return body;
}

// Reset the parser state
Napi::Value HttpParser::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Reset();

  return env.Undefined();
}

// Parse the request line with zero-copy approach
bool HttpParser::ParseRequestLine(Napi::Env env, Napi::Object result) {
  // Find the end of the request line
  const char* endOfLine = FindSubstring(currentBuffer_ + bufferOffset_,
                                     bufferLength_ - bufferOffset_,
                                     "\r\n", 2);
  if (!endOfLine) {
    return false;
  }

  size_t lineLength = endOfLine - (currentBuffer_ + bufferOffset_);

  // Find the method portion
  const char* methodEnd = FindSubstring(currentBuffer_ + bufferOffset_, lineLength, " ", 1);

  if (!methodEnd) {
    return false;
  }

  // Create string view for method
  std::string_view methodView(currentBuffer_ + bufferOffset_, methodEnd - (currentBuffer_ + bufferOffset_));

  // Set method in result object
  result.Set("method", Napi::String::New(env, std::string(methodView)));

  // Skip the space
  size_t urlOffset = (methodEnd - currentBuffer_) + 1;

  // Find the URL portion
  const char* urlEnd = FindSubstring(currentBuffer_ + urlOffset, lineLength - (urlOffset - bufferOffset_), " ", 1);

  if (!urlEnd) {
    return false;
  }

  // Create string view for URL
  std::string_view urlView(currentBuffer_ + urlOffset, urlEnd - (currentBuffer_ + urlOffset));

  // Set URL in result object
  result.Set("url", Napi::String::New(env, std::string(urlView)));

  // Skip the space
  size_t versionOffset = (urlEnd - currentBuffer_) + 1;

  // Create string view for version
  std::string_view versionView(currentBuffer_ + versionOffset, endOfLine - (currentBuffer_ + versionOffset));

  // Parse version (HTTP/1.1)
  size_t slashPos = versionView.find('/');
  if (slashPos != std::string::npos) {
    size_t dotPos = versionView.find('.', slashPos);
    if (dotPos != std::string::npos) {
      int versionMajor = std::stoi(std::string(versionView.substr(slashPos + 1, dotPos - slashPos - 1)));
      int versionMinor = std::stoi(std::string(versionView.substr(dotPos + 1)));

      // Set version in result object
      result.Set("versionMajor", Napi::Number::New(env, versionMajor));
      result.Set("versionMinor", Napi::Number::New(env, versionMinor));
    }
  }

  // Update offset to after CRLF
  bufferOffset_ = (endOfLine - currentBuffer_) + 2;

  return true;
}

// Parse HTTP headers with zero-copy approach and optimized normalization
bool HttpParser::ParseHeaders(Napi::Env env, Napi::Object headers) {
  // Find the end of headers (double CRLF)
  const char* endOfHeaders = FindSubstring(currentBuffer_ + bufferOffset_, bufferLength_ - bufferOffset_, "\r\n\r\n", 4);
  if (!endOfHeaders) {
    return false;
  }

  // Calculate the length of the headers section
  size_t headersLength = endOfHeaders - (currentBuffer_ + bufferOffset_);
  headerEndOffset_ = bufferOffset_ + headersLength + 4; // +4 for the \r\n\r\n

  // Parse each header line
  size_t lineStart = bufferOffset_;
  while (lineStart < bufferOffset_ + headersLength) {
    // Find the end of this line
    const char* endOfLine = FindSubstring(currentBuffer_ + lineStart, bufferOffset_ + headersLength - lineStart, "\r\n", 2);
    if (!endOfLine) {
      break;
    }

    size_t lineLength = endOfLine - (currentBuffer_ + lineStart);

    // Find the colon
    const char* colon = FindSubstring(currentBuffer_ + lineStart, lineLength, ":", 1);
    if (colon) {
      // Extract key and value
      std::string_view keyView(currentBuffer_ + lineStart, colon - (currentBuffer_ + lineStart));
      std::string_view valueView(colon + 1, endOfLine - (colon + 1));

      // Trim leading spaces from value
      while (!valueView.empty() && valueView[0] == ' ') {
        valueView.remove_prefix(1);
      }

      // Convert key to string and normalize to lowercase for consistent lookup
      std::string keyLower = ToLowercase(keyView);

      // Get normalized header name from cache or use the lowercase version
      std::string normalizedName;
      auto it = headerNames_.find(keyLower);
      if (it != headerNames_.end()) {
        normalizedName = it->second;
      } else {
        // If not in the cache, use the original casing
        normalizedName = std::string(keyView);
        // Also add to the cache for future lookups
        headerNames_[keyLower] = normalizedName;
      }

      // Add to headers object with consistent casing
      headers.Set(keyLower, Napi::String::New(env, std::string(valueView)));

      // Also store in our internal map for reference
      headers_[keyLower] = std::string(valueView);
    }

    // Move to the next line
    lineStart = (endOfLine - currentBuffer_) + 2; // +2 for the \r\n
  }

  // Update offset to after headers
  bufferOffset_ = headerEndOffset_;
  bodyOffset_ = headerEndOffset_;
  headerComplete_ = true;

  return true;
}

// Helper method to get a buffer from the object pool
Napi::Buffer<char> HttpParser::GetBuffer(Napi::Env env, size_t size) {
  if (useObjectPool_) {
    // Create arguments array for the getBuffer method
    std::vector<napi_value> args = { Napi::Number::New(env, size) };

    // Call the getBuffer method on the object pool
    Napi::Value result = objectPool_.Value().As<Napi::Object>().Get("getBuffer").As<Napi::Function>().Call(objectPool_.Value(), args);

    // Return the buffer
    return result.As<Napi::Buffer<char>>();
  } else {
    // Create a new buffer
    return Napi::Buffer<char>::New(env, size);
  }
}

// Helper method to release a buffer back to the pool
void HttpParser::ReleaseBuffer(Napi::Buffer<char> buffer) {
  if (useObjectPool_) {
    // Create arguments array for the releaseBuffer method
    std::vector<napi_value> args = { buffer };

    // Call the releaseBuffer method on the object pool
    objectPool_.Value().As<Napi::Object>().Get("releaseBuffer").As<Napi::Function>().Call(objectPool_.Value(), args);
  }
}

// Helper method to get a headers object from the pool
Napi::Object HttpParser::GetHeadersObject(Napi::Env env) {
  if (useObjectPool_) {
    // Call the getHeadersObject method on the object pool
    Napi::Value result = objectPool_.Value().As<Napi::Object>().Get("getHeadersObject").As<Napi::Function>().Call(objectPool_.Value(), {});

    // Return the headers object
    return result.As<Napi::Object>();
  } else {
    // Create a new object
    return Napi::Object::New(env);
  }
}

// Helper method to release a headers object back to the pool
void HttpParser::ReleaseHeadersObject(Napi::Object headersObj) {
  if (useObjectPool_) {
    // Create arguments array for the releaseHeadersObject method
    std::vector<napi_value> args = { headersObj };

    // Call the releaseHeadersObject method on the object pool
    objectPool_.Value().As<Napi::Object>().Get("releaseHeadersObject").As<Napi::Function>().Call(objectPool_.Value(), args);
  }
}

// Helper methods for string views
std::string_view HttpParser::CreateStringView(size_t start, size_t length) {
  if (start >= bufferLength_) {
    return std::string_view();
  }

  if (start + length > bufferLength_) {
    length = bufferLength_ - start;
  }

  return std::string_view(currentBuffer_ + start, length);
}

std::string_view HttpParser::CreateStringView(size_t start) {
  if (start >= bufferLength_) {
    return std::string_view();
  }

  return std::string_view(currentBuffer_ + start, bufferLength_ - start);
}

// Implement FindSubstring method
const char* HttpParser::FindSubstring(
    const char* haystack, size_t haystackLen,
    const char* needle, size_t needleLen
  ) {
  if (needleLen > haystackLen) return nullptr;
  if (needleLen == 0) return haystack;

  const char* end = haystack + haystackLen - needleLen + 1;
  for (const char* p = haystack; p < end; p++) {
    if (!memcmp(p, needle, needleLen)) {
      return p;
    }
  }

  return nullptr;
}

// URL decode helper
std::string HttpParser::UrlDecode(const std::string_view& input) {
  std::string result;
  result.reserve(input.length());

  for (size_t i = 0; i < input.length(); i++) {
    if (input[i] == '%' && i + 2 < input.length()) {
      // Get the hex value
      unsigned int value;
      if (sscanf(input.data() + i + 1, "%2x", &value) == 1) {
        result += static_cast<char>(value);
        i += 2;
      } else {
        result += input[i];
      }
    } else if (input[i] == '+') {
      result += ' ';
    } else {
      result += input[i];
    }
  }

  return result;
}

// Header name normalization with caching
std::string HttpParser::NormalizeHeaderName(const std::string& name) {
  // First convert to lowercase for lookup using our optimized method
  std::string lowerName = ToLowercase(name);

  // Check if we have a cached normalized name
  auto it = headerNames_.find(lowerName);
  if (it != headerNames_.end()) {
    return it->second;
  }

  // Not in cache - use a standard header casing approach
  // (e.g., content-type -> Content-Type)
  std::string normalized = lowerName;
  bool capitalizeNext = true;

  for (char& c : normalized) {
    if (capitalizeNext && std::islower(c)) {
      c = std::toupper(c);
      capitalizeNext = false;
    } else if (c == '-') {
      capitalizeNext = true;
    } else {
      capitalizeNext = false;
    }
  }

  // Cache the result for future lookups
  headerNames_[lowerName] = normalized;

  return normalized;
}

// Add a new method to get header value as a string_view
std::string_view HttpParser::GetHeaderValueView(const std::string& name) const {
  for (const auto& header : headers_) {
    if (CaseInsensitiveCompare(header.first, name)) {
      return std::string_view(header.second);
    }
  }
  return std::string_view();
}
