#include <napi.h>
#include <string>
#include <unordered_map>
#include <string_view>
#include <cstring>
#include "url_parser.h"

/**
 * URL Parser implementation
 * Provides fast URL parsing for Node.js
 */
namespace UrlParser {

  struct UrlParts {
    std::string protocol;
    std::string auth;
    std::string hostname;
    std::string port;
    std::string pathname;
    std::string search;
    std::string hash;
  };

  // Optimized URL parsing without regex - using string_view for zero-copy parsing
  UrlParts parseUrl(const char* url, size_t length) {
    UrlParts parts;

    // Fast path for empty URL
    if (length == 0) {
      return parts;
    }

    size_t pos = 0;

    // Parse protocol
    for (size_t i = 0; i < length - 2; i++) {
      if (url[i] == ':' && url[i+1] == '/' && url[i+2] == '/') {
        parts.protocol = std::string(url, i);
        pos = i + 3; // Skip "://"
        break;
      }
    }

    // Check if we have authority part (//...)
    bool hasAuthority = false;
    if (pos == 0 && length >= 2 && url[0] == '/' && url[1] == '/') {
      hasAuthority = true;
      pos = 2; // Skip "//"
    }

    if (hasAuthority || !parts.protocol.empty()) {
      // Find end of authority (next '/' or end of string)
      size_t authorityEnd = length;
      for (size_t i = pos; i < length; i++) {
        if (url[i] == '/' || url[i] == '?' || url[i] == '#') {
          authorityEnd = i;
          break;
        }
      }

      // Extract authority
      std::string_view authority(url + pos, authorityEnd - pos);

      // Parse auth (username:password@)
      size_t authEnd = authority.find('@');
      if (authEnd != std::string_view::npos) {
        parts.auth = std::string(authority.substr(0, authEnd));
        authority = authority.substr(authEnd + 1);
      }

      // Parse hostname and port
      size_t portStart = authority.find(':');
      if (portStart != std::string_view::npos) {
        parts.hostname = std::string(authority.substr(0, portStart));
        parts.port = std::string(authority.substr(portStart + 1));
      } else {
        parts.hostname = std::string(authority);
      }

      pos = authorityEnd;
    }

    // Parse pathname
    size_t pathnameEnd = length;
    for (size_t i = pos; i < length; i++) {
      if (url[i] == '?' || url[i] == '#') {
        pathnameEnd = i;
        break;
      }
    }

    parts.pathname = std::string(url + pos, pathnameEnd - pos);
    pos = pathnameEnd;

    // Parse search
    if (pos < length && url[pos] == '?') {
      size_t searchEnd = length;
      for (size_t i = pos + 1; i < length; i++) {
        if (url[i] == '#') {
          searchEnd = i;
          break;
        }
      }
      parts.search = std::string(url + pos + 1, searchEnd - pos - 1);
      pos = searchEnd;
    }

    // Parse hash
    if (pos < length && url[pos] == '#') {
      parts.hash = std::string(url + pos + 1, length - pos - 1);
    }

    return parts;
  }

  // Optimized query string parsing using string_view for zero-copy operations
  std::unordered_map<std::string, std::string> parseQueryString(const char* queryString, size_t length) {
    std::unordered_map<std::string, std::string> queryParams;
    queryParams.reserve(16); // Pre-allocate for better performance

    // Fast path for empty query string
    if (length == 0) {
      return queryParams;
    }

    size_t start = 0;

    for (size_t i = 0; i < length; i++) {
      if (queryString[i] == '&' || i == length - 1) {
        // Handle the last parameter
        size_t end = (i == length - 1) ? length : i;
        size_t paramLength = end - start;

        if (paramLength > 0) {
          // Find the equals sign
          size_t equals = start;
          while (equals < end && queryString[equals] != '=') {
            equals++;
          }

          if (equals < end) {
            // We have a key-value pair
            std::string key(queryString + start, equals - start);
            std::string value(queryString + equals + 1, end - equals - 1);
            queryParams[key] = value;
          } else {
            // We have a key with no value
            std::string key(queryString + start, paramLength);
            queryParams[key] = "";
          }
        }

        start = i + 1;
      }
    }

    return queryParams;
  }

  Napi::Value Parse(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || (!info[0].IsString() && !info[0].IsBuffer())) {
      Napi::TypeError::New(env, "String or Buffer expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    const char* url;
    size_t length;
    std::string urlStr;

    // Avoid string conversion if possible
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      url = buffer.Data();
      length = buffer.Length();
    } else {
      urlStr = info[0].As<Napi::String>().Utf8Value();
      url = urlStr.c_str();
      length = urlStr.length();
    }

    UrlParts parts = parseUrl(url, length);

    Napi::Object result = Napi::Object::New(env);
    result.Set("protocol", Napi::String::New(env, parts.protocol));
    result.Set("auth", Napi::String::New(env, parts.auth));
    result.Set("hostname", Napi::String::New(env, parts.hostname));
    result.Set("port", Napi::String::New(env, parts.port));
    result.Set("pathname", Napi::String::New(env, parts.pathname));
    result.Set("search", Napi::String::New(env, parts.search));
    result.Set("hash", Napi::String::New(env, parts.hash));

    return result;
  }

  Napi::Value ParseQueryString(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || (!info[0].IsString() && !info[0].IsBuffer())) {
      Napi::TypeError::New(env, "String or Buffer expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    const char* queryString;
    size_t length;
    std::string queryStr;

    // Avoid string conversion if possible
    if (info[0].IsBuffer()) {
      Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
      queryString = buffer.Data();
      length = buffer.Length();
    } else {
      queryStr = info[0].As<Napi::String>().Utf8Value();
      queryString = queryStr.c_str();
      length = queryStr.length();
    }

    auto queryParams = parseQueryString(queryString, length);

    Napi::Object result = Napi::Object::New(env);
    for (const auto& pair : queryParams) {
      result.Set(pair.first, Napi::String::New(env, pair.second));
    }

    return result;
  }

  // Format a URL from parts
  Napi::Value Format(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object urlObj = info[0].As<Napi::Object>();

    // Pre-allocate a string with a reasonable size
    std::string result;
    result.reserve(256);

    // Add protocol if present
    if (urlObj.HasOwnProperty("protocol") && urlObj.Get("protocol").IsString()) {
      std::string protocol = urlObj.Get("protocol").As<Napi::String>().Utf8Value();
      if (!protocol.empty()) {
        result += protocol;
        // Add :// if not already present
        if (protocol.back() != ':') {
          result += ':';
        }
        if (protocol.length() < 2 || protocol.substr(protocol.length() - 2) != "//") {
          result += "//";
        }
      }
    }

    // Add auth if present
    if (urlObj.HasOwnProperty("auth") && urlObj.Get("auth").IsString()) {
      std::string auth = urlObj.Get("auth").As<Napi::String>().Utf8Value();
      if (!auth.empty()) {
        result += auth;
        result += '@';
      }
    }

    // Add hostname if present
    if (urlObj.HasOwnProperty("hostname") && urlObj.Get("hostname").IsString()) {
      result += urlObj.Get("hostname").As<Napi::String>().Utf8Value();
    }

    // Add port if present
    if (urlObj.HasOwnProperty("port") && urlObj.Get("port").IsString()) {
      std::string port = urlObj.Get("port").As<Napi::String>().Utf8Value();
      if (!port.empty()) {
        result += ':';
        result += port;
      }
    }

    // Add pathname if present
    if (urlObj.HasOwnProperty("pathname") && urlObj.Get("pathname").IsString()) {
      std::string pathname = urlObj.Get("pathname").As<Napi::String>().Utf8Value();
      if (!pathname.empty() && pathname[0] != '/') {
        result += '/';
      }
      result += pathname;
    }

    // Add search if present
    if (urlObj.HasOwnProperty("search") && urlObj.Get("search").IsString()) {
      std::string search = urlObj.Get("search").As<Napi::String>().Utf8Value();
      if (!search.empty()) {
        if (search[0] != '?') {
          result += '?';
        }
        result += search;
      }
    }

    // Add hash if present
    if (urlObj.HasOwnProperty("hash") && urlObj.Get("hash").IsString()) {
      std::string hash = urlObj.Get("hash").As<Napi::String>().Utf8Value();
      if (!hash.empty()) {
        if (hash[0] != '#') {
          result += '#';
        }
        result += hash;
      }
    }

    return Napi::String::New(env, result);
  }

  // Format a query string from an object
  Napi::Value FormatQueryString(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object queryObj = info[0].As<Napi::Object>();
    Napi::Array keys = queryObj.GetPropertyNames();

    // Pre-allocate a string with a reasonable size
    std::string result;
    result.reserve(256);

    for (uint32_t i = 0; i < keys.Length(); i++) {
      Napi::Value key = keys.Get(i);
      Napi::Value value = queryObj.Get(key);

      if (i > 0) {
        result += '&';
      }

      result += key.As<Napi::String>().Utf8Value();
      result += '=';

      if (value.IsString()) {
        result += value.As<Napi::String>().Utf8Value();
      } else if (!value.IsNull() && !value.IsUndefined()) {
        // Convert non-string values to string
        Napi::String strValue = value.ToString();
        result += strValue.Utf8Value();
      }
    }

    return Napi::String::New(env, result);
  }

  Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("parse", Napi::Function::New(env, Parse));
    exports.Set("parseQueryString", Napi::Function::New(env, ParseQueryString));
    exports.Set("format", Napi::Function::New(env, Format));
    exports.Set("formatQueryString", Napi::Function::New(env, FormatQueryString));
    return exports;
  }

} // namespace UrlParser
