#ifndef SCHEMA_VALIDATOR_H
#define SCHEMA_VALIDATOR_H

#include <napi.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <functional>

namespace SchemaValidator {

  struct ValidationError {
    std::string path;
    std::string message;
  };

  // Schema version tracking for caching
  struct SchemaVersion {
    std::string id;
    std::string hash;
    uint64_t version;
  };

  // Forward declarations
  class Schema;
  class CompiledValidator;

  // Cache entry for compiled validators
  struct CacheEntry {
    std::shared_ptr<CompiledValidator> validator;
    SchemaVersion version;
    uint64_t lastAccessed;
    uint64_t accessCount;
  };

  // Generated validation function type
  using ValidatorFunction = std::function<bool(const Napi::Value&, std::vector<ValidationError>&, const std::string&)>;

  // Main interface
  Napi::Object Init(Napi::Env env, Napi::Object exports);

  // Core validation functions
  Napi::Value Validate(const Napi::CallbackInfo& info);
  Napi::Value ValidatePartial(const Napi::CallbackInfo& info);
  Napi::Value CompileSchema(const Napi::CallbackInfo& info);
  Napi::Value ClearCache(const Napi::CallbackInfo& info);
  Napi::Value GetCacheStats(const Napi::CallbackInfo& info);

  // Schema compilation and code generation
  std::shared_ptr<CompiledValidator> CompileSchemaInternal(const Napi::Object& schemaObj);
  std::shared_ptr<Schema> ParseSchema(const Napi::Object& schemaObj);

  // Schema hashing for version checking
  std::string ComputeSchemaHash(const Napi::Object& schema);

  // Validator code generation
  ValidatorFunction GenerateValidator(const std::shared_ptr<Schema>& schema);

  // Cache management
  bool AddToCache(const std::string& id, const std::string& hash,
                 std::shared_ptr<CompiledValidator> validator);
  std::shared_ptr<CompiledValidator> GetFromCache(const std::string& id, const std::string& hash);
  void PruneCache();

  // Incremental validation
  bool ValidateIncrementalUpdate(const Napi::Object& data, const Napi::Object& updates,
                                const std::shared_ptr<Schema>& schema,
                                std::vector<ValidationError>& errors);
}

#endif // SCHEMA_VALIDATOR_H
