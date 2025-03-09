#include <napi.h>
#include "http/http_parser.h"
#include "routing/radix_router.h"
#include "json/json_processor.h"

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  // Initialize all native components
  HttpParser::Init(env, exports);
  RadixRouter::Init(env, exports);
  JsonProcessor::Init(env, exports);

  return exports;
}

NODE_API_MODULE(nexurejs_native, InitModule)
