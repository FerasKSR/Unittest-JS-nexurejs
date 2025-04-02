{
  "targets": [
    {
      "target_name": "nexurejs_native",
      "sources": [
        "src/native/main.cc",
        "src/native/http/http_parser.cc",
        "src/native/http/object_pool.cc",
        "src/native/routing/radix_router.cc",
        "src/native/json/json_processor.cc",
        "src/native/url/url_parser.cc",
        "src/native/schema/schema_validator.cc",
        "src/native/compression/compression.cc",
        "src/native/websocket/websocket.cc",
        "src/native/json/simdjson_wrapper.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(node -e \"require('node-addon-api').include_dir\")",
        "<!(node -e \"console.log(require('node-addon-api').libuv_include_dir)\")",
        "src/native",
        "src/native/json"
      ],
      "conditions": [
        ["OS!='win'", {
          "include_dirs": [
            "/usr/local/include",
            "node_modules/simdjson/simdjson/src",
            "node_modules/simdjson/include"
          ]
        }]
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
      "cflags_cc": [
        "-Wno-error=unused-but-set-variable",
        "-Wno-error=unused-variable"
      ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "WARNING_CFLAGS": [
          "-Wno-bitwise-instead-of-logical",
          "-Wno-ambiguous-reversed-operator",
          "-Werror",
          "-Wno-error=unused-but-set-variable",
          "-Wno-error=unused-variable"
        ]
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [
            "/w34100",  // Unreachable code
            "/w34189"   // Local variable is initialized but not referenced
          ]
        }
      }
    },
    {
      "target_name": "nothing",
      "type": "static_library",
      "sources": [ "nothing.c" ],
      "configurations": {
        "Release": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 0,  // static release
              "Optimization": 3,    // /Ox, full optimization
              "FavorSizeOrSpeed": 1,
              "InlineFunctionExpansion": 2,
              "WholeProgramOptimization": "true",
              "OmitFramePointers": "true",
              "EnableFunctionLevelLinking": "true",
              "EnableIntrinsicFunctions": "true"
            }
          }
        }
      }
    }
  ]
}
