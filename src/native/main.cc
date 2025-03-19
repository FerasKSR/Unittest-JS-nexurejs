#include <napi.h>
#include "json/simdjson_wrapper.h"
#include "http/http_parser.h"
#include "json/json_processor.h"
#include "routing/radix_router.h"
#include "url/url_parser.h"
#include "schema/schema_validator.h"
#include "compression/compression.h"
#include "websocket/websocket.h"

namespace nexurejs {

/**
 * Check if the native module is available
 */
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, true);
}

/**
 * Initialize the NexureJS native module
 * This file serves as the entry point for the native module
 * It initializes all the native components and exports them
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Initialize simdjson
  simdjson::builtin_implementation();

  // Initialize all components
  HttpParser::Init(env, exports);
  RadixRouter::Init(env, exports);
  JsonProcessor::Init(env, exports);
  UrlParser::Init(env, exports);
  SchemaValidator::Init(env, exports);
  Compression::Init(env, exports);
  InitWebSocket(env, exports);

  // Export version information
  exports.Set("version", Napi::String::New(env, "0.1.9"));
  exports.Set("isNative", Napi::Boolean::New(env, true));

  // Export isAvailable function
  exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));

  return exports;
}

} // namespace nexurejs

// Register the module with Node.js
napi_value init(napi_env env, napi_value exports) {
  Napi::Env napi_env(env);
  Napi::Object napi_exports = Napi::Object(napi_env, exports);
  return nexurejs::Init(napi_env, napi_exports);
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
