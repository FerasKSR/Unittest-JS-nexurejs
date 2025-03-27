#include <napi.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <memory>
#include <string_view>
#include <functional>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <list>
#include <regex>
#include <cmath>
#include "schema_validator.h"

/**
 * Schema Validator implementation
 * Provides fast JSON schema validation with code generation for optimal performance
 */
namespace SchemaValidator {

  // Cache configuration
  constexpr size_t MAX_CACHE_SIZE = 100;

  // Performance tracking
  uint64_t totalValidations = 0;
  uint64_t cacheHits = 0;
  uint64_t cacheMisses = 0;
  uint64_t generationTime = 0;
  uint64_t validationTime = 0;

  class Schema;
  class CompiledValidator;
  bool validateValue(const Napi::Value& value, const Schema& schema, const std::string& path, std::vector<ValidationError>& errors);
  std::shared_ptr<Schema> ParseSchema(const Napi::Object& schemaObj, const std::string& path);

  // LRU Cache for compiled schemas
  class SchemaCache {
  private:
    std::unordered_map<std::string, std::list<CacheEntry>::iterator> cacheMap;
    std::list<CacheEntry> cacheList;
    size_t maxSize;
    uint64_t hits = 0;
    uint64_t misses = 0;
    uint64_t evictions = 0;

  public:
    SchemaCache(size_t maxSize = MAX_CACHE_SIZE) : maxSize(maxSize) {}

    bool add(const std::string& key, const SchemaVersion& version, std::shared_ptr<CompiledValidator> validator) {
      auto now = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch()).count());

      // Check if already in cache
      auto it = cacheMap.find(key);
      if (it != cacheMap.end()) {
        // Update existing entry
        auto listIt = it->second;
        listIt->validator = validator;
        listIt->version = version;
        listIt->lastAccessed = now;
        listIt->accessCount++;

        // Move to front
        cacheList.splice(cacheList.begin(), cacheList, listIt);
        return true;
      }

      // Check if need to evict
      if (cacheList.size() >= maxSize) {
        // Remove the least recently used item
        auto last = cacheList.end();
        --last;
        cacheMap.erase(last->version.id + ":" + last->version.hash);
        cacheList.pop_back();
        evictions++;
      }

      // Add new entry to front
      cacheList.emplace_front(CacheEntry{
        validator,
        version,
        now,
        1
      });

      cacheMap[key] = cacheList.begin();
      return true;
    }

    std::shared_ptr<CompiledValidator> get(const std::string& key) {
      auto it = cacheMap.find(key);
      if (it == cacheMap.end()) {
        misses++;
        return nullptr;
      }

      auto listIt = it->second;
      auto now = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch()).count());

      // Update access time
      listIt->lastAccessed = now;
      listIt->accessCount++;

      // Move to front
      cacheList.splice(cacheList.begin(), cacheList, listIt);

      hits++;
      return listIt->validator;
    }

    void clear() {
      cacheMap.clear();
      cacheList.clear();
    }

    // Statistics
    size_t size() const { return cacheList.size(); }
    uint64_t getHits() const { return hits; }
    uint64_t getMisses() const { return misses; }
    uint64_t getEvictions() const { return evictions; }

    // Get all entries for debugging
    std::vector<CacheEntry> getEntries() const {
      std::vector<CacheEntry> entries;
      entries.reserve(cacheList.size());
      for (const auto& entry : cacheList) {
        entries.push_back(entry);
      }
      return entries;
    }
  };

  // Global cache instance
  SchemaCache schemaCache;

  // Schema class with optimized memory layout
  class Schema {
  public:
    std::string type;
    bool required = false;
    int minLength = -1;
    int maxLength = -1;
    double minimum = -std::numeric_limits<double>::infinity();
    double maximum = std::numeric_limits<double>::infinity();
    bool exclusiveMinimum = false;
    bool exclusiveMaximum = false;
    std::string pattern;
    std::unordered_map<std::string, std::shared_ptr<Schema>> properties;
    std::vector<std::string> requiredProperties;
    std::shared_ptr<Schema> items;
    std::vector<std::shared_ptr<Schema>> anyOf;
    std::vector<std::shared_ptr<Schema>> allOf;
    std::vector<std::shared_ptr<Schema>> oneOf;
    std::shared_ptr<Schema> not_;
    std::string format;
    int minItems = -1;
    int maxItems = -1;
    bool uniqueItems = false;

    // Schema path for error reporting
    std::string path;

    // New fields for incremental validation
    bool additionalProperties = true;
    std::shared_ptr<Schema> additionalPropertiesSchema;

    // For schema version tracking
    std::string id;
    uint64_t version = 0;

    // Validation method implementations
    bool validateString(const std::string& value, const std::string& path, std::vector<ValidationError>& errors) const {
      bool valid = true;

      // Validate minLength
      if (minLength >= 0 && static_cast<int>(value.length()) < minLength) {
        errors.push_back({path, "String is too short (minimum length is " + std::to_string(minLength) + ")"});
        valid = false;
      }

      // Validate maxLength
      if (maxLength >= 0 && static_cast<int>(value.length()) > maxLength) {
        errors.push_back({path, "String is too long (maximum length is " + std::to_string(maxLength) + ")"});
        valid = false;
      }

      // Validate pattern (basic implementation for now)
      if (!pattern.empty()) {
        try {
          std::regex patternRegex(pattern);
          if (!std::regex_match(value, patternRegex)) {
            errors.push_back({path, "String does not match pattern: " + pattern});
            valid = false;
          }
        } catch (const std::regex_error&) {
          errors.push_back({path, "Invalid regex pattern in schema: " + pattern});
          valid = false;
        }
      }

      return valid;
    }

    bool validateNumber(double value, const std::string& path, std::vector<ValidationError>& errors) const {
      bool valid = true;

      // Validate minimum
      if (exclusiveMinimum && value <= minimum) {
        errors.push_back({path, "Value must be greater than " + std::to_string(minimum)});
        valid = false;
      } else if (!exclusiveMinimum && value < minimum) {
        errors.push_back({path, "Value must be greater than or equal to " + std::to_string(minimum)});
        valid = false;
      }

      // Validate maximum
      if (exclusiveMaximum && value >= maximum) {
        errors.push_back({path, "Value must be less than " + std::to_string(maximum)});
        valid = false;
      } else if (!exclusiveMaximum && value > maximum) {
        errors.push_back({path, "Value must be less than or equal to " + std::to_string(maximum)});
        valid = false;
      }

      // Validate integer type
      if (type == "integer" && std::floor(value) != value) {
        errors.push_back({path, "Value must be an integer"});
        valid = false;
      }

      return valid;
    }

    bool validateObject(const Napi::Object& obj, const std::string& path, std::vector<ValidationError>& errors) const {
      bool valid = true;

      // Check required properties
      for (const auto& prop : requiredProperties) {
        if (!obj.HasOwnProperty(prop.c_str())) {
          errors.push_back({path, "Missing required property: " + prop});
          valid = false;
        }
      }

      // Validate existing properties
      Napi::Array propNames = obj.GetPropertyNames();
      for (uint32_t i = 0; i < propNames.Length(); i++) {
        std::string propName = propNames.Get(i).As<Napi::String>().Utf8Value();
        Napi::Value propValue = obj.Get(propName);

        // Check if property exists in schema
        auto propIt = properties.find(propName);
        if (propIt != properties.end()) {
          // Validate against property schema
          bool propValid = validateValue(propValue, *(propIt->second), path + "." + propName, errors);
          if (!propValid) {
            valid = false;
          }
        } else if (!additionalProperties && !additionalPropertiesSchema) {
          // No additional properties allowed
          errors.push_back({path, "Property not allowed: " + propName});
          valid = false;
        } else if (additionalPropertiesSchema) {
          // Validate against additionalProperties schema
          bool propValid = validateValue(propValue, *additionalPropertiesSchema, path + "." + propName, errors);
          if (!propValid) {
            valid = false;
          }
        }
      }

      return valid;
    }

    bool validateArray(const Napi::Array& arr, const std::string& path, std::vector<ValidationError>& errors) const {
      bool valid = true;

      // Validate minItems
      if (minItems >= 0 && static_cast<int>(arr.Length()) < minItems) {
        errors.push_back({path, "Array is too short (minimum items is " + std::to_string(minItems) + ")"});
        valid = false;
      }

      // Validate maxItems
      if (maxItems >= 0 && static_cast<int>(arr.Length()) > maxItems) {
        errors.push_back({path, "Array is too long (maximum items is " + std::to_string(maxItems) + ")"});
        valid = false;
      }

      // Validate items
      if (items) {
        for (uint32_t i = 0; i < arr.Length(); i++) {
          bool itemValid = validateValue(arr.Get(i), *items, path + "[" + std::to_string(i) + "]", errors);
          if (!itemValid) {
            valid = false;
          }
        }
      }

      // Validate uniqueItems
      if (uniqueItems && arr.Length() > 1) {
        // Basic uniqueness check (can be optimized)
        std::unordered_set<std::string> seen;
        for (uint32_t i = 0; i < arr.Length(); i++) {
          Napi::Value item = arr.Get(i);
          std::string itemStr;

          // Convert to string representation for comparison (simplified)
          if (item.IsString()) {
            itemStr = item.As<Napi::String>().Utf8Value();
          } else if (item.IsNumber()) {
            itemStr = std::to_string(item.As<Napi::Number>().DoubleValue());
          } else if (item.IsBoolean()) {
            itemStr = item.As<Napi::Boolean>().Value() ? "true" : "false";
          } else {
            // Complex objects would need better serialization
            continue;
          }

          if (seen.find(itemStr) != seen.end()) {
            errors.push_back({path, "Array items must be unique"});
            valid = false;
            break;
          }
          seen.insert(itemStr);
        }
      }

      return valid;
    }
  };

  // Compiled validator with generated validation code
  class CompiledValidator {
  public:
    std::shared_ptr<Schema> schema;
    ValidatorFunction validator;
    SchemaVersion version;

    CompiledValidator(std::shared_ptr<Schema> schema, ValidatorFunction validator, SchemaVersion version)
        : schema(schema), validator(validator), version(version) {}

    bool validate(const Napi::Value& value, std::vector<ValidationError>& errors, const std::string& path = "$") const {
      if (!validator) {
        // Fallback to generic validation if code generation failed
        return validateValue(value, *schema, path, errors);
      }
      return validator(value, errors, path);
    }
  };

  // Parse schema object from JavaScript
  std::shared_ptr<Schema> ParseSchema(const Napi::Object& schemaObj, const std::string& path) {
    auto schema = std::make_shared<Schema>();
    schema->path = path;

    // Check for schema ID for caching
    if (schemaObj.HasOwnProperty("$id") && schemaObj.Get("$id").IsString()) {
      schema->id = schemaObj.Get("$id").As<Napi::String>().Utf8Value();
    }

    // Parse basic properties
    if (schemaObj.HasOwnProperty("type") && schemaObj.Get("type").IsString()) {
      schema->type = schemaObj.Get("type").As<Napi::String>().Utf8Value();
    }

    if (schemaObj.HasOwnProperty("required") && schemaObj.Get("required").IsBoolean()) {
      schema->required = schemaObj.Get("required").As<Napi::Boolean>().Value();
    }

    if (schemaObj.HasOwnProperty("minLength") && schemaObj.Get("minLength").IsNumber()) {
      schema->minLength = schemaObj.Get("minLength").As<Napi::Number>().Int32Value();
    }

    if (schemaObj.HasOwnProperty("maxLength") && schemaObj.Get("maxLength").IsNumber()) {
      schema->maxLength = schemaObj.Get("maxLength").As<Napi::Number>().Int32Value();
    }

    if (schemaObj.HasOwnProperty("minimum") && schemaObj.Get("minimum").IsNumber()) {
      schema->minimum = schemaObj.Get("minimum").As<Napi::Number>().DoubleValue();
    }

    if (schemaObj.HasOwnProperty("maximum") && schemaObj.Get("maximum").IsNumber()) {
      schema->maximum = schemaObj.Get("maximum").As<Napi::Number>().DoubleValue();
    }

    if (schemaObj.HasOwnProperty("exclusiveMinimum") && schemaObj.Get("exclusiveMinimum").IsBoolean()) {
      schema->exclusiveMinimum = schemaObj.Get("exclusiveMinimum").As<Napi::Boolean>().Value();
    }

    if (schemaObj.HasOwnProperty("exclusiveMaximum") && schemaObj.Get("exclusiveMaximum").IsBoolean()) {
      schema->exclusiveMaximum = schemaObj.Get("exclusiveMaximum").As<Napi::Boolean>().Value();
    }

    if (schemaObj.HasOwnProperty("pattern") && schemaObj.Get("pattern").IsString()) {
      schema->pattern = schemaObj.Get("pattern").As<Napi::String>().Utf8Value();
    }

    if (schemaObj.HasOwnProperty("format") && schemaObj.Get("format").IsString()) {
      schema->format = schemaObj.Get("format").As<Napi::String>().Utf8Value();
    }

    if (schemaObj.HasOwnProperty("minItems") && schemaObj.Get("minItems").IsNumber()) {
      schema->minItems = schemaObj.Get("minItems").As<Napi::Number>().Int32Value();
    }

    if (schemaObj.HasOwnProperty("maxItems") && schemaObj.Get("maxItems").IsNumber()) {
      schema->maxItems = schemaObj.Get("maxItems").As<Napi::Number>().Int32Value();
    }

    if (schemaObj.HasOwnProperty("uniqueItems") && schemaObj.Get("uniqueItems").IsBoolean()) {
      schema->uniqueItems = schemaObj.Get("uniqueItems").As<Napi::Boolean>().Value();
    }

    // Handle additionalProperties for incremental validation
    if (schemaObj.HasOwnProperty("additionalProperties")) {
      auto additionalProps = schemaObj.Get("additionalProperties");
      if (additionalProps.IsBoolean()) {
        schema->additionalProperties = additionalProps.As<Napi::Boolean>().Value();
      } else if (additionalProps.IsObject()) {
        schema->additionalProperties = true;
        schema->additionalPropertiesSchema = ParseSchema(
          additionalProps.As<Napi::Object>(),
          path + ".additionalProperties"
        );
      }
    }

    // Parse properties for object schemas
    if (schemaObj.HasOwnProperty("properties") && schemaObj.Get("properties").IsObject()) {
      Napi::Object props = schemaObj.Get("properties").As<Napi::Object>();
      Napi::Array propNames = props.GetPropertyNames();

      // Pre-allocate space for properties
      uint32_t propCount = propNames.Length();
      schema->properties.reserve(propCount);

      for (uint32_t i = 0; i < propCount; i++) {
        std::string propName = propNames.Get(i).As<Napi::String>().Utf8Value();
        if (props.Get(propName).IsObject()) {
          schema->properties[propName] = ParseSchema(
            props.Get(propName).As<Napi::Object>(),
            path + ".properties." + propName
          );
        }
      }
    }

    // Parse required properties array
    if (schemaObj.HasOwnProperty("required") && schemaObj.Get("required").IsArray()) {
      Napi::Array required = schemaObj.Get("required").As<Napi::Array>();

      // Pre-allocate space for required properties
      uint32_t reqCount = required.Length();
      schema->requiredProperties.reserve(reqCount);

      for (uint32_t i = 0; i < reqCount; i++) {
        if (required.Get(i).IsString()) {
          schema->requiredProperties.push_back(required.Get(i).As<Napi::String>().Utf8Value());
        }
      }
    }

    // Parse items for array schemas
    if (schemaObj.HasOwnProperty("items") && schemaObj.Get("items").IsObject()) {
      schema->items = ParseSchema(
        schemaObj.Get("items").As<Napi::Object>(),
        path + ".items"
      );
    }

    // Parse compound schemas (anyOf, allOf, oneOf, not)
    if (schemaObj.HasOwnProperty("anyOf") && schemaObj.Get("anyOf").IsArray()) {
      Napi::Array anyOfArr = schemaObj.Get("anyOf").As<Napi::Array>();
      uint32_t count = anyOfArr.Length();
      schema->anyOf.reserve(count);

      for (uint32_t i = 0; i < count; i++) {
        if (anyOfArr.Get(i).IsObject()) {
          schema->anyOf.push_back(ParseSchema(
            anyOfArr.Get(i).As<Napi::Object>(),
            path + ".anyOf[" + std::to_string(i) + "]"
          ));
        }
      }
    }

    if (schemaObj.HasOwnProperty("allOf") && schemaObj.Get("allOf").IsArray()) {
      Napi::Array allOfArr = schemaObj.Get("allOf").As<Napi::Array>();
      uint32_t count = allOfArr.Length();
      schema->allOf.reserve(count);

      for (uint32_t i = 0; i < count; i++) {
        if (allOfArr.Get(i).IsObject()) {
          schema->allOf.push_back(ParseSchema(
            allOfArr.Get(i).As<Napi::Object>(),
            path + ".allOf[" + std::to_string(i) + "]"
          ));
        }
      }
    }

    if (schemaObj.HasOwnProperty("oneOf") && schemaObj.Get("oneOf").IsArray()) {
      Napi::Array oneOfArr = schemaObj.Get("oneOf").As<Napi::Array>();
      uint32_t count = oneOfArr.Length();
      schema->oneOf.reserve(count);

      for (uint32_t i = 0; i < count; i++) {
        if (oneOfArr.Get(i).IsObject()) {
          schema->oneOf.push_back(ParseSchema(
            oneOfArr.Get(i).As<Napi::Object>(),
            path + ".oneOf[" + std::to_string(i) + "]"
          ));
        }
      }
    }

    if (schemaObj.HasOwnProperty("not") && schemaObj.Get("not").IsObject()) {
      schema->not_ = ParseSchema(
        schemaObj.Get("not").As<Napi::Object>(),
        path + ".not"
      );
    }

    return schema;
  }

  // Helper functions for type checking
  inline bool isType(const Napi::Value& value, const std::string& type) {
    if (type == "string") return value.IsString();
    if (type == "number") return value.IsNumber();
    if (type == "integer") return value.IsNumber() && value.As<Napi::Number>().Int32Value() == value.As<Napi::Number>().DoubleValue();
    if (type == "boolean") return value.IsBoolean();
    if (type == "object") return value.IsObject() && !value.IsArray();
    if (type == "array") return value.IsArray();
    if (type == "null") return value.IsNull();
    return false;
  }

  // Compute a hash for a schema to detect changes
  std::string computeSchemaHash(const Napi::Object& schemaObj) {
    std::stringstream ss;

    // Serialize the schema to a canonical form
    // This is a simple implementation - in production, you would use a more robust approach
    Napi::Value json = schemaObj.Get("toString").As<Napi::Function>().Call(schemaObj, {});
    std::string jsonStr = json.As<Napi::String>().Utf8Value();

    // Compute a hash
    std::hash<std::string> hasher;
    size_t hash = hasher(jsonStr);

    ss << std::hex << std::setw(16) << std::setfill('0') << hash;
    return ss.str();
  }

  // Compile a schema into an optimized validator
  std::shared_ptr<CompiledValidator> CompileSchemaInternal(const Napi::Object& schemaObj) {
    auto startTime = std::chrono::high_resolution_clock::now();

    // Parse the schema into our internal representation
    auto schema = ParseSchema(schemaObj, "$");

    // Create a schema version for caching
    SchemaVersion version;
    version.id = schema->id;
    version.hash = computeSchemaHash(schemaObj);
    version.version = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();

    // Generate optimized validation code
    auto validator = GenerateValidator(schema);

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
    generationTime += duration;

    // Create the compiled validator
    auto compiledValidator = std::make_shared<CompiledValidator>(schema, validator, version);

    // Add to cache if it has an ID
    if (!schema->id.empty()) {
      std::string cacheKey = schema->id + ":" + version.hash;
      schemaCache.add(cacheKey, version, compiledValidator);
    }

    return compiledValidator;
  }

  // Forward declarations
  bool validateValue(const Napi::Value& value, const Schema& schema, const std::string& path, std::vector<ValidationError>& errors);
  std::shared_ptr<Schema> ParseSchema(const Napi::Object& schemaObj, const std::string& path);

  // Validate a value against a schema - optimized version
  bool validateValue(const Napi::Value& value, const Schema& schema, const std::string& path, std::vector<ValidationError>& errors) {
    // Check if value is required but null or undefined
    if (schema.required && (value.IsNull() || value.IsUndefined())) {
      errors.push_back({path, "Value is required"});
      return false;
    }

    // Skip validation for null or undefined values if not required
    if (value.IsNull() || value.IsUndefined()) {
      return true;
    }

    // Type validation
    if (!schema.type.empty() && !isType(value, schema.type)) {
      errors.push_back({path, "Invalid type"});
      return false;
    }

    // Use optimized type-specific validation methods
    if (schema.type == "string" && value.IsString()) {
      return schema.validateString(value.As<Napi::String>().Utf8Value(), path, errors);
    }

    if ((schema.type == "number" || schema.type == "integer") && value.IsNumber()) {
      return schema.validateNumber(value.As<Napi::Number>().DoubleValue(), path, errors);
    }

    if (schema.type == "object" && value.IsObject() && !value.IsArray()) {
      return schema.validateObject(value.As<Napi::Object>(), path, errors);
    }

    if (schema.type == "array" && value.IsArray()) {
      return schema.validateArray(value.As<Napi::Array>(), path, errors);
    }

    return errors.empty();
  }

  // ========== JavaScript Interface Functions ==========

  // Main validation function
  Napi::Value Validate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsObject() || (!info[1].IsObject() && !info[1].IsArray())) {
      Napi::TypeError::New(env, "Expected (schema, data)").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object schemaObj = info[0].As<Napi::Object>();
    Napi::Value data = info[1];

    auto startTime = std::chrono::high_resolution_clock::now();
    totalValidations++;

    // Get schema ID and compute hash for caching
    std::string schemaId = "";
    std::string schemaHash = "";

    if (schemaObj.HasOwnProperty("$id") && schemaObj.Get("$id").IsString()) {
      schemaId = schemaObj.Get("$id").As<Napi::String>().Utf8Value();
      schemaHash = computeSchemaHash(schemaObj);

      // Try to get from cache
      std::string cacheKey = schemaId + ":" + schemaHash;
      auto cachedValidator = schemaCache.get(cacheKey);

      if (cachedValidator) {
        // Cache hit - use compiled validator
        cacheHits++;

        // Pre-allocate errors vector
        std::vector<ValidationError> errors;
        errors.reserve(16);

        // Validate using the cached validator
        cachedValidator->validate(data, errors);

        auto endTime = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
        validationTime += duration;

        // Create result object
        Napi::Object result = Napi::Object::New(env);
        result.Set("valid", Napi::Boolean::New(env, errors.empty()));

        // Create errors array
        Napi::Array errorsArray = Napi::Array::New(env, errors.size());
        for (size_t i = 0; i < errors.size(); i++) {
          Napi::Object error = Napi::Object::New(env);
          error.Set("path", Napi::String::New(env, errors[i].path));
          error.Set("message", Napi::String::New(env, errors[i].message));
          errorsArray.Set(i, error);
        }

        result.Set("errors", errorsArray);
        return result;
      }
    }

    // Cache miss or no ID - compile schema
    cacheMisses++;
    auto compiledValidator = CompileSchemaInternal(schemaObj);

    // Pre-allocate errors vector
    std::vector<ValidationError> errors;
    errors.reserve(16);

    // Validate data
    compiledValidator->validate(data, errors);

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
    validationTime += duration;

    // Create result object
    Napi::Object result = Napi::Object::New(env);
    result.Set("valid", Napi::Boolean::New(env, errors.empty()));

    // Create errors array
    Napi::Array errorsArray = Napi::Array::New(env, errors.size());
    for (size_t i = 0; i < errors.size(); i++) {
      Napi::Object error = Napi::Object::New(env);
      error.Set("path", Napi::String::New(env, errors[i].path));
      error.Set("message", Napi::String::New(env, errors[i].message));
      errorsArray.Set(i, error);
    }

    result.Set("errors", errorsArray);
    return result;
  }

  // Validate partial updates against a schema and existing data
  Napi::Value ValidatePartial(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsObject() || !info[1].IsObject() || !info[2].IsObject()) {
      Napi::TypeError::New(env, "Expected (schema, data, updates)").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object schemaObj = info[0].As<Napi::Object>();
    Napi::Object data = info[1].As<Napi::Object>();
    Napi::Object updates = info[2].As<Napi::Object>();

    auto startTime = std::chrono::high_resolution_clock::now();
    totalValidations++;

    // Get schema ID and compute hash for caching
    std::string schemaId = "";
    std::string schemaHash = "";

    if (schemaObj.HasOwnProperty("$id") && schemaObj.Get("$id").IsString()) {
      schemaId = schemaObj.Get("$id").As<Napi::String>().Utf8Value();
      schemaHash = computeSchemaHash(schemaObj);

      // Try to get from cache
      std::string cacheKey = schemaId + ":" + schemaHash;
      auto cachedValidator = schemaCache.get(cacheKey);

      if (cachedValidator) {
        // Cache hit
        cacheHits++;

        // Pre-allocate errors vector
        std::vector<ValidationError> errors;
        errors.reserve(16);

        // Validate incremental update
        bool valid = ValidateIncrementalUpdate(data, updates, cachedValidator->schema, errors);

        auto endTime = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
        validationTime += duration;

        // Create result object
        Napi::Object result = Napi::Object::New(env);
        result.Set("valid", Napi::Boolean::New(env, valid));

        // Create errors array
        Napi::Array errorsArray = Napi::Array::New(env, errors.size());
        for (size_t i = 0; i < errors.size(); i++) {
          Napi::Object error = Napi::Object::New(env);
          error.Set("path", Napi::String::New(env, errors[i].path));
          error.Set("message", Napi::String::New(env, errors[i].message));
          errorsArray.Set(i, error);
        }

        result.Set("errors", errorsArray);
        return result;
      }
    }

    // Cache miss or no ID - compile schema
    cacheMisses++;
    auto compiledValidator = CompileSchemaInternal(schemaObj);

    // Pre-allocate errors vector
    std::vector<ValidationError> errors;
    errors.reserve(16);

    // Validate incremental update
    bool valid = ValidateIncrementalUpdate(data, updates, compiledValidator->schema, errors);

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
    validationTime += duration;

    // Create result object
    Napi::Object result = Napi::Object::New(env);
    result.Set("valid", Napi::Boolean::New(env, valid));

    // Create errors array
    Napi::Array errorsArray = Napi::Array::New(env, errors.size());
    for (size_t i = 0; i < errors.size(); i++) {
      Napi::Object error = Napi::Object::New(env);
      error.Set("path", Napi::String::New(env, errors[i].path));
      error.Set("message", Napi::String::New(env, errors[i].message));
      errorsArray.Set(i, error);
    }

    result.Set("errors", errorsArray);
    return result;
  }

  // Compile a schema and return a reference
  Napi::Value CompileSchema(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected (schema)").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object schemaObj = info[0].As<Napi::Object>();

    // Compile the schema
    auto compiledValidator = CompileSchemaInternal(schemaObj);

    // Create a reference object to return
    Napi::Object result = Napi::Object::New(env);

    // Set schema ID and version
    result.Set("id", Napi::String::New(env, compiledValidator->version.id));
    result.Set("hash", Napi::String::New(env, compiledValidator->version.hash));
    result.Set("version", Napi::Number::New(env, compiledValidator->version.version));

    return result;
  }

  // Clear the schema cache
  Napi::Value ClearCache(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Clear the cache
    schemaCache.clear();

    Napi::Object result = Napi::Object::New(env);
    result.Set("success", Napi::Boolean::New(env, true));

    return result;
  }

  // Get cache statistics
  Napi::Value GetCacheStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Object stats = Napi::Object::New(env);
    stats.Set("cacheSize", Napi::Number::New(env, schemaCache.size()));
    stats.Set("cacheHits", Napi::Number::New(env, schemaCache.getHits()));
    stats.Set("cacheMisses", Napi::Number::New(env, schemaCache.getMisses()));
    stats.Set("cacheEvictions", Napi::Number::New(env, schemaCache.getEvictions()));
    stats.Set("hitRatio", Napi::Number::New(env,
      schemaCache.getHits() + schemaCache.getMisses() > 0
      ? (double)schemaCache.getHits() / (schemaCache.getHits() + schemaCache.getMisses())
      : 0.0));
    stats.Set("totalValidations", Napi::Number::New(env, totalValidations));
    stats.Set("generationTime", Napi::Number::New(env, generationTime));
    stats.Set("validationTime", Napi::Number::New(env, validationTime));

    return stats;
  }

  // Initialize the module
  Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("validate", Napi::Function::New(env, Validate));
    exports.Set("validatePartial", Napi::Function::New(env, ValidatePartial));
    exports.Set("compileSchema", Napi::Function::New(env, CompileSchema));
    exports.Set("clearCache", Napi::Function::New(env, ClearCache));
    exports.Set("getCacheStats", Napi::Function::New(env, GetCacheStats));
    return exports;
  }

  // Generate a specialized validator function for the schema
  ValidatorFunction GenerateValidator(const std::shared_ptr<Schema>& schema) {
    // This is where the code generation magic happens!
    // Instead of using the generic validator, we build a specialized function
    // that performs only the checks needed for this specific schema

    return [schema](const Napi::Value& value, std::vector<ValidationError>& errors, const std::string& path) -> bool {
      // Start with size of errors to track if we added any
      const size_t initialErrorCount = errors.size();

      // Handle required check
      if (schema->required && (value.IsNull() || value.IsUndefined())) {
        errors.push_back({path, "Value is required"});
        return false;
      }

      // Skip validation for null or undefined values if not required
      if (value.IsNull() || value.IsUndefined()) {
        return true;
      }

      // Type validation - only if type is specified
      if (!schema->type.empty()) {
        if (!isType(value, schema->type)) {
          errors.push_back({path, "Invalid type, expected " + schema->type});
          return false;
        }

        // Type-specific validations
        if (schema->type == "string" && value.IsString()) {
          std::string strValue = value.As<Napi::String>().Utf8Value();
          size_t length = strValue.length();

          // Check minLength
          if (schema->minLength >= 0 && length < static_cast<size_t>(schema->minLength)) {
            errors.push_back({path, "String too short, minimum length: " + std::to_string(schema->minLength)});
          }

          // Check maxLength
          if (schema->maxLength >= 0 && length > static_cast<size_t>(schema->maxLength)) {
            errors.push_back({path, "String too long, maximum length: " + std::to_string(schema->maxLength)});
          }

          // Check pattern
          if (!schema->pattern.empty()) {
            // In production code, you would use regex here
            if (strValue.find(schema->pattern) == std::string::npos) {
              errors.push_back({path, "String does not match pattern: " + schema->pattern});
            }
          }

          // Check format if specified
          if (!schema->format.empty()) {
            // Basic format validation - in production, implement more formats
            if (schema->format == "email") {
              if (strValue.find('@') == std::string::npos) {
                errors.push_back({path, "Invalid email format"});
              }
            }
          }
        }
        else if ((schema->type == "number" || schema->type == "integer") && value.IsNumber()) {
          double numValue = value.As<Napi::Number>().DoubleValue();

          // Integer validation
          if (schema->type == "integer" && std::floor(numValue) != numValue) {
            errors.push_back({path, "Expected integer"});
          }

          // Check minimum
          if (schema->exclusiveMinimum && numValue <= schema->minimum) {
            errors.push_back({path, "Value must be greater than " + std::to_string(schema->minimum)});
          } else if (!schema->exclusiveMinimum && numValue < schema->minimum) {
            errors.push_back({path, "Value must be greater than or equal to " + std::to_string(schema->minimum)});
          }

          // Check maximum
          if (schema->exclusiveMaximum && numValue >= schema->maximum) {
            errors.push_back({path, "Value must be less than " + std::to_string(schema->maximum)});
          } else if (!schema->exclusiveMaximum && numValue > schema->maximum) {
            errors.push_back({path, "Value must be less than or equal to " + std::to_string(schema->maximum)});
          }
        }
        else if (schema->type == "array" && value.IsArray()) {
          Napi::Array array = value.As<Napi::Array>();
          uint32_t length = array.Length();

          // Check minItems
          if (schema->minItems >= 0 && length < static_cast<uint32_t>(schema->minItems)) {
            errors.push_back({path, "Array too short, minimum items: " + std::to_string(schema->minItems)});
          }

          // Check maxItems
          if (schema->maxItems >= 0 && length > static_cast<uint32_t>(schema->maxItems)) {
            errors.push_back({path, "Array too long, maximum items: " + std::to_string(schema->maxItems)});
          }

          // Check uniqueItems
          if (schema->uniqueItems && length > 0) {
            // This is a simple implementation - in production, use a more efficient approach
            std::unordered_set<std::string> uniqueValues;
            for (uint32_t i = 0; i < length; i++) {
              Napi::Value item = array.Get(i);
              if (item.IsString()) {
                std::string str = item.As<Napi::String>().Utf8Value();
                if (uniqueValues.find(str) != uniqueValues.end()) {
                  errors.push_back({path, "Array items must be unique"});
                  break;
                }
                uniqueValues.insert(str);
              }
              else if (item.IsNumber()) {
                std::string num = std::to_string(item.As<Napi::Number>().DoubleValue());
                if (uniqueValues.find(num) != uniqueValues.end()) {
                  errors.push_back({path, "Array items must be unique"});
                  break;
                }
                uniqueValues.insert(num);
              }
              // For complex objects, this approach is simplified
            }
          }

          // Validate items if schema has items defined
          if (schema->items) {
            std::string basePath = path + "[";
            for (uint32_t i = 0; i < length; i++) {
              std::string itemPath = basePath + std::to_string(i) + "]";
              validateValue(array.Get(i), *schema->items, itemPath, errors);
            }
          }
        }
        else if (schema->type == "object" && value.IsObject() && !value.IsArray()) {
          Napi::Object obj = value.As<Napi::Object>();

          // Check required properties
          for (const auto& prop : schema->requiredProperties) {
            if (!obj.HasOwnProperty(prop)) {
              errors.push_back({path + "." + prop, "Required property missing"});
            }
          }

          // Validate properties
          Napi::Array propNames = obj.GetPropertyNames();
          uint32_t propCount = propNames.Length();

          for (uint32_t i = 0; i < propCount; i++) {
            std::string propName = propNames.Get(i).As<Napi::String>().Utf8Value();

            // Check if property is defined in schema
            auto propIt = schema->properties.find(propName);
            if (propIt != schema->properties.end()) {
              // Validate property against its schema
              validateValue(obj.Get(propName), *propIt->second, path + "." + propName, errors);
            } else if (!schema->additionalProperties) {
              // If additionalProperties is false, disallow undefined properties
              errors.push_back({path + "." + propName, "Additional property not allowed"});
            } else if (schema->additionalPropertiesSchema) {
              // If additionalProperties is a schema, validate against it
              validateValue(obj.Get(propName), *schema->additionalPropertiesSchema, path + "." + propName, errors);
            }
          }
        }
      }

      // Validate compound schemas

      // anyOf validation
      if (!schema->anyOf.empty()) {
        bool anyValid = false;
        std::vector<ValidationError> anyOfErrors;

        for (const auto& subSchema : schema->anyOf) {
          std::vector<ValidationError> subErrors;
          if (validateValue(value, *subSchema, path, subErrors)) {
            anyValid = true;
            break;
          }
          anyOfErrors.insert(anyOfErrors.end(), subErrors.begin(), subErrors.end());
        }

        if (!anyValid) {
          errors.push_back({path, "Did not match any of the schemas"});
          // We could add all sub-errors here, but that gets verbose
        }
      }

      // allOf validation
      if (!schema->allOf.empty()) {
        for (const auto& subSchema : schema->allOf) {
          validateValue(value, *subSchema, path, errors);
        }
      }

      // oneOf validation
      if (!schema->oneOf.empty()) {
        int validCount = 0;

        for (const auto& subSchema : schema->oneOf) {
          std::vector<ValidationError> subErrors;
          if (validateValue(value, *subSchema, path, subErrors)) {
            validCount++;
          }
        }

        if (validCount != 1) {
          errors.push_back({path, "Should match exactly one schema"});
        }
      }

      // not validation
      if (schema->not_) {
        std::vector<ValidationError> notErrors;
        if (validateValue(value, *schema->not_, path, notErrors)) {
          errors.push_back({path, "Should not match schema"});
        }
      }

      // Return true if we didn't add any errors
      return errors.size() == initialErrorCount;
    };
  }

  // Incremental validation for partial updates
  bool ValidateIncrementalUpdate(const Napi::Object& data, const Napi::Object& updates,
                                 const std::shared_ptr<Schema>& schema,
                                 std::vector<ValidationError>& errors) {
    if (!schema || (!schema->type.empty() && schema->type != "object")) {
      errors.push_back({"$", "Schema must be an object schema for incremental validation"});
      return false;
    }

    // Get update properties
    Napi::Array updateProps = updates.GetPropertyNames();
    uint32_t propCount = updateProps.Length();

    // Track if validation was successful
    bool valid = true;

    // Validate each property in updates
    for (uint32_t i = 0; i < propCount; i++) {
      std::string propName = updateProps.Get(i).As<Napi::String>().Utf8Value();
      Napi::Value propValue = updates.Get(propName);

      // Find property schema
      auto propSchemaIt = schema->properties.find(propName);
      if (propSchemaIt != schema->properties.end()) {
        // Validate property against its schema
        if (!validateValue(propValue, *propSchemaIt->second, "$." + propName, errors)) {
          valid = false;
        }
      } else if (!schema->additionalProperties) {
        // If additionalProperties is false, disallow undefined properties
        errors.push_back({"$." + propName, "Additional property not allowed"});
        valid = false;
      } else if (schema->additionalPropertiesSchema) {
        // If additionalProperties is a schema, validate against it
        if (!validateValue(propValue, *schema->additionalPropertiesSchema, "$." + propName, errors)) {
          valid = false;
        }
      }
    }

    // Create a virtual merged object to validate required properties
    if (!schema->requiredProperties.empty()) {
      std::unordered_set<std::string> existingProps;

      // Get existing properties from data
      if (data.IsObject() && !data.IsArray()) {
        Napi::Array dataProps = data.GetPropertyNames();
        uint32_t dataPropCount = dataProps.Length();

        for (uint32_t i = 0; i < dataPropCount; i++) {
          existingProps.insert(dataProps.Get(i).As<Napi::String>().Utf8Value());
        }
      }

      // Add update properties
      for (uint32_t i = 0; i < propCount; i++) {
        existingProps.insert(updateProps.Get(i).As<Napi::String>().Utf8Value());
      }

      // Check required properties
      for (const auto& requiredProp : schema->requiredProperties) {
        if (existingProps.find(requiredProp) == existingProps.end()) {
          errors.push_back({"$." + requiredProp, "Required property missing after update"});
          valid = false;
        }
      }
    }

    return valid;
  }

} // namespace SchemaValidator
