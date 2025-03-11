#ifndef SCHEMA_VALIDATOR_H
#define SCHEMA_VALIDATOR_H

#include <napi.h>

namespace SchemaValidator {
  Napi::Object Init(Napi::Env env, Napi::Object exports);
}

#endif // SCHEMA_VALIDATOR_H
