/**
 * SimdJSON Wrapper Implementation
 *
 * This file wraps the simdjson library implementation to suppress warnings.
 */

// Disable specific warnings for simdjson
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wbitwise-instead-of-logical"
#pragma GCC diagnostic ignored "-Wambiguous-reversed-operator"

// Include the original simdjson implementation
#include "../../../node_modules/simdjson/simdjson/src/simdjson.cpp"

// Restore warning settings
#pragma GCC diagnostic pop
