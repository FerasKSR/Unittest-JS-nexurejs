{
  "targets": [
    {
      "target_name": "nexurejs_native",
      "sources": [
        "src/native/main.cc",
        "src/native/http/http_parser.cc",
        "src/native/routing/radix_router.cc",
        "src/native/json/json_processor.cc",
        "src/native/url/url_parser.cc",
        "src/native/schema/schema_validator.cc",
        "src/native/compression/compression.cc",
        "src/native/websocket/websocket.cc",
        "node_modules/simdjson/simdjson/src/simdjson.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/local/include",
        "<!(node -e \"require('node-addon-api').include_dir\")",
        "<!(node -e \"console.log(require('node-addon-api').libuv_include_dir)\")",
        "src/native",
        "node_modules/simdjson/simdjson/src"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      },
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      }
    }
  ]
}
