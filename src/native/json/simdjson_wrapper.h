/**
 * SimdJSON Wrapper
 *
 * This file wraps the simdjson library to suppress warnings.
 */

#ifndef SIMDJSON_WRAPPER_H
#define SIMDJSON_WRAPPER_H

// First try to include from node_modules
#if __has_include(<node_modules/simdjson/include/simdjson.h>)
  #include <node_modules/simdjson/include/simdjson.h>
// Try standard include path
#elif __has_include(<simdjson.h>)
  #include <simdjson.h>
// Check for local path (for Windows compatibility)
#elif __has_include("simdjson.h")
  #include "simdjson.h"
#else
  #error "Could not find simdjson.h header"
#endif

#if defined(__GNUC__) || defined(__clang__)
// Check if the specific GCC diagnostic is available
#if defined(__has_warning)
#  if __has_warning("-Wbitwise-instead-of-logical")
#    pragma GCC diagnostic ignored "-Wbitwise-instead-of-logical"
#  endif
#  if __has_warning("-Wambiguous-reversed-operator")
#    pragma GCC diagnostic ignored "-Wambiguous-reversed-operator"
#  endif
#endif
#endif

// Safely include simdjson
namespace simdjson {
  // This is a proxy namespace that helps avoid direct inclusion
  // of problematic simdjson headers in other files
  using namespace ::simdjson;

  // Check if simdjson is available and operational at runtime
  inline bool isAvailable() {
    try {
      simdjson::dom::parser parser;
      simdjson::dom::element element;
      std::string test_json = "{\"test\":true}";
      auto err = parser.parse(test_json).get(element);
      return (err == simdjson::error_code::SUCCESS);
    } catch (...) {
      return false;
    }
  }

  // Get simdjson implementation name
  inline std::string getImplementation() {
#if defined(SIMDJSON_BUILTIN_IMPLEMENTATION)
    return simdjson::builtin_implementation()->name();
#else
    return "stub";
#endif
  }
}

#endif // SIMDJSON_WRAPPER_H
