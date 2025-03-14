{
  "targets": [
    {
      "target_name": "nexurejs",
      "sources": [
        "src/native/**/*.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/local/include",
        "<!(node -e \"require('node-addon-api').include_dir\")",
        "<!(node -e \"console.log(require('node-addon-api').libuv_include_dir)\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      }
    }
  ]
}
