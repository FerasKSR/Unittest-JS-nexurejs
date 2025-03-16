#include <napi.h>
#include <simdjson.h>
#include "http/http_parser.h"
#include "json/json_processor.h"
#include "routing/radix_router.h"
#include "url/url_parser.h"
#include "schema/schema_validator.h"
#include "compression/compression.h"
#include "websocket/websocket.h"

namespace nexurejs {

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

  return exports;
}

} // namespace nexurejs

// Register the module with Node.js
napi_value init(napi_env env, napi_value exports) {
  return nexurejs::Init(env, Napi::Object(env, exports)).ToObject();
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
