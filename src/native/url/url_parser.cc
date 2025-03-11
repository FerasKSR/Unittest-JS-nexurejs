#include <napi.h>
#include <string>
#include <unordered_map>
#include <regex>
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

  UrlParts parseUrl(const std::string& url) {
    UrlParts parts;

    // Regular expression for URL parsing
    // This is a simplified version for performance
    std::regex urlRegex(
      "^(?:([^:/?#]+):)?(?://(?:([^/?#]*)@)?([^/:?#]*)(?::([0-9]+))?)?([^?#]*)(?:\\?([^#]*))?(?:#(.*))?$"
    );

    std::smatch matches;
    if (std::regex_match(url, matches, urlRegex)) {
      if (matches.size() >= 8) {
        parts.protocol = matches[1].str();
        parts.auth = matches[2].str();
        parts.hostname = matches[3].str();
        parts.port = matches[4].str();
        parts.pathname = matches[5].str();
        parts.search = matches[6].str();
        parts.hash = matches[7].str();
      }
    }

    return parts;
  }

  std::unordered_map<std::string, std::string> parseQueryString(const std::string& queryString) {
    std::unordered_map<std::string, std::string> queryParams;

    size_t start = 0;
    size_t end = queryString.find('&');

    while (start < queryString.length()) {
      std::string keyValue;

      if (end != std::string::npos) {
        keyValue = queryString.substr(start, end - start);
        start = end + 1;
        end = queryString.find('&', start);
      } else {
        keyValue = queryString.substr(start);
        start = queryString.length();
      }

      size_t equals = keyValue.find('=');
      if (equals != std::string::npos) {
        std::string key = keyValue.substr(0, equals);
        std::string value = keyValue.substr(equals + 1);
        queryParams[key] = value;
      } else if (!keyValue.empty()) {
        queryParams[keyValue] = "";
      }
    }

    return queryParams;
  }

  Napi::Value Parse(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
      Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string url = info[0].As<Napi::String>().Utf8Value();
    UrlParts parts = parseUrl(url);

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

    if (info.Length() < 1 || !info[0].IsString()) {
      Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string queryString = info[0].As<Napi::String>().Utf8Value();
    auto queryParams = parseQueryString(queryString);

    Napi::Object result = Napi::Object::New(env);
    for (const auto& pair : queryParams) {
      result.Set(pair.first, Napi::String::New(env, pair.second));
    }

    return result;
  }

  Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("parse", Napi::Function::New(env, Parse));
    exports.Set("parseQueryString", Napi::Function::New(env, ParseQueryString));
    return exports;
  }

} // namespace UrlParser
