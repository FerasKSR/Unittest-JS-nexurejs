#include "http_parser.h"
#include <cstring>
#include <algorithm>
#include <cctype>

// Helper function to convert string to lowercase
std::string ToLowerCase(const std::string& str) {
  std::string result = str;
  std::transform(result.begin(), result.end(), result.begin(),
                [](unsigned char c) { return std::tolower(c); });
  return result;
}

// Initialize the HTTP parser class
Napi::Object HttpParser::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "HttpParser", {
    InstanceMethod("parse", &HttpParser::Parse),
    InstanceMethod("reset", &HttpParser::Reset)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("HttpParser", func);
  return exports;
}

// Create a new instance of the parser
Napi::Object HttpParser::NewInstance(Napi::Env env) {
  Napi::EscapableHandleScope scope(env);
  Napi::FunctionReference* constructor = env.GetInstanceData<Napi::FunctionReference>();
  return scope.Escape(constructor->New({})).ToObject();
}

// Constructor
HttpParser::HttpParser(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<HttpParser>(info), headerComplete_(false), contentLength_(0) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
}

// Parse an HTTP request buffer
Napi::Value HttpParser::Parse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
  const char* data = buffer.Data();
  size_t length = buffer.Length();

  try {
    size_t offset = 0;

    // Parse the request line if not already done
    if (method_.empty()) {
      ParseRequestLine(data, length, offset);
    }

    // Parse headers if not complete
    if (!headerComplete_) {
      ParseHeaders(data, length, offset);
    }

    // Parse body if headers are complete
    if (headerComplete_ && offset < length) {
      ParseBody(data, length, offset);
    }

    // Create result object
    Napi::Object result = Napi::Object::New(env);
    result.Set("method", Napi::String::New(env, method_));
    result.Set("url", Napi::String::New(env, url_));
    result.Set("httpVersion", Napi::String::New(env, httpVersion_));

    // Add headers
    Napi::Object headersObj = Napi::Object::New(env);
    for (const auto& header : headers_) {
      headersObj.Set(header.first, Napi::String::New(env, header.second));
    }
    result.Set("headers", headersObj);

    // Add body if present
    if (!body_.empty()) {
      Napi::Buffer<char> bodyBuffer = Napi::Buffer<char>::Copy(
        env, body_.data(), body_.size());
      result.Set("body", bodyBuffer);
    } else {
      result.Set("body", env.Null());
    }

    // Add parsing status
    result.Set("complete", Napi::Boolean::New(env,
      headerComplete_ && (contentLength_ == 0 || body_.size() >= contentLength_)));

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Reset the parser state
Napi::Value HttpParser::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  method_.clear();
  url_.clear();
  httpVersion_.clear();
  headers_.clear();
  body_.clear();
  headerComplete_ = false;
  contentLength_ = 0;

  return env.Undefined();
}

// Parse the HTTP request line
void HttpParser::ParseRequestLine(const char* buffer, size_t length, size_t& offset) {
  // Find the end of the request line
  const char* end = static_cast<const char*>(memchr(buffer + offset, '\n', length - offset));
  if (!end) {
    throw std::runtime_error("Incomplete request line");
  }

  // Calculate the line length (excluding CR)
  size_t lineLength = end - (buffer + offset);
  if (lineLength > 0 && *(end - 1) == '\r') {
    lineLength--;
  }

  // Extract the line
  std::string line(buffer + offset, lineLength);
  offset = end - buffer + 1; // Move past the newline

  // Parse method, URL, and HTTP version
  size_t methodEnd = line.find(' ');
  if (methodEnd == std::string::npos) {
    throw std::runtime_error("Invalid request line format");
  }

  method_ = line.substr(0, methodEnd);

  size_t urlStart = methodEnd + 1;
  size_t urlEnd = line.find(' ', urlStart);
  if (urlEnd == std::string::npos) {
    throw std::runtime_error("Invalid request line format");
  }

  url_ = line.substr(urlStart, urlEnd - urlStart);
  httpVersion_ = line.substr(urlEnd + 1);
}

// Parse HTTP headers
void HttpParser::ParseHeaders(const char* buffer, size_t length, size_t& offset) {
  while (offset < length) {
    // Check for empty line (end of headers)
    if (buffer[offset] == '\r' && offset + 1 < length && buffer[offset + 1] == '\n') {
      offset += 2;
      headerComplete_ = true;

      // Get content length if present
      auto it = headers_.find("content-length");
      if (it != headers_.end()) {
        contentLength_ = std::stoul(it->second);
      }

      return;
    }

    // Find the end of the current header line
    const char* end = static_cast<const char*>(memchr(buffer + offset, '\n', length - offset));
    if (!end) {
      // Incomplete header, wait for more data
      return;
    }

    // Calculate the line length (excluding CR)
    size_t lineLength = end - (buffer + offset);
    if (lineLength > 0 && *(end - 1) == '\r') {
      lineLength--;
    }

    // Extract the line
    std::string line(buffer + offset, lineLength);
    offset = end - buffer + 1; // Move past the newline

    // Parse header name and value
    size_t colonPos = line.find(':');
    if (colonPos != std::string::npos) {
      std::string name = line.substr(0, colonPos);
      std::string value = line.substr(colonPos + 1);

      // Trim leading/trailing whitespace from value
      value.erase(0, value.find_first_not_of(" \t"));
      value.erase(value.find_last_not_of(" \t") + 1);

      // Store header (case-insensitive name)
      headers_[ToLowerCase(name)] = value;
    }
  }
}

// Parse HTTP body
void HttpParser::ParseBody(const char* buffer, size_t length, size_t& offset) {
  // Append body data
  size_t remainingBytes = length - offset;
  body_.insert(body_.end(), buffer + offset, buffer + length);
  offset = length; // Consumed all data
}
