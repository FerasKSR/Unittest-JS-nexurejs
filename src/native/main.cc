#include <napi.h>
#include "http/http_parser.h"
#include "routing/radix_router.h"
#include "json/json_processor.h"
#include "url/url_parser.h"
#include "schema/schema_validator.h"
#include "compression/compression.h"

/**
 * Initialize the NexureJS native module
 * This file serves as the entry point for the native module
 * It initializes all the native components and exports them
 */
Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  // Initialize HTTP Parser
  HttpParser::Init(env, exports);

  // Initialize Radix Router
  RadixRouter::Init(env, exports);

  // Initialize JSON Processor
  JsonProcessor::Init(env, exports);

  // Initialize URL Parser
  UrlParser::Init(env, exports);

  // Initialize Schema Validator
  SchemaValidator::Init(env, exports);

  // Initialize Compression
  Compression::Init(env, exports);

  // Export version information
  exports.Set(Napi::String::New(env, "version"), Napi::String::New(env, "1.0.0"));

  // Export a method to check if native module is available
  exports.Set(
    Napi::String::New(env, "isAvailable"),
    Napi::Function::New(env, [](const Napi::CallbackInfo& info) -> Napi::Value {
      Napi::Env env = info.Env();
      return Napi::Boolean::New(env, true);
    })
  );

  return exports;
}

// Register the module with Node.js
NODE_API_MODULE(nexurejs_native, InitModule)
