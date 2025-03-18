/**
 * SimdJSON Wrapper
 *
 * This file wraps the simdjson library to suppress warnings.
 */

#pragma once

// Disable specific warnings for simdjson
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wbitwise-instead-of-logical"
#pragma GCC diagnostic ignored "-Wambiguous-reversed-operator"

// Include the original simdjson header
#include <simdjson.h>

// Restore warning settings
#pragma GCC diagnostic pop
