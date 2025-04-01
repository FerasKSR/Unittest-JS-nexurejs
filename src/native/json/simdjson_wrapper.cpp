/**
 * SimdJSON Wrapper Implementation
 *
 * This file wraps the simdjson library implementation to suppress warnings.
 */

// Disable specific warnings for simdjson
#ifdef __GNUC__
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-variable"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"
#pragma GCC diagnostic ignored "-Wsign-compare"
#pragma GCC diagnostic ignored "-Wconversion"
#pragma GCC diagnostic ignored "-Wfloat-equal"
#pragma GCC diagnostic ignored "-Wdouble-promotion"
#pragma GCC diagnostic ignored "-Wpedantic"
#endif

// Include the original simdjson implementation
#include "../../../node_modules/simdjson/simdjson/src/simdjson.cpp"

// Restore warning settings
#ifdef __GNUC__
#pragma GCC diagnostic pop
#endif
