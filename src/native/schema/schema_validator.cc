#include <napi.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <memory>
#include <string_view>
#include "schema_validator.h"

/**
 * Schema Validator implementation
 * Provides fast JSON schema validation for Node.js
 */
namespace SchemaValidator {

  struct ValidationError {
    std::string path;
    std::string message;
  };

  // Forward declarations
  class Schema;
  bool validateValue(const Napi::Value& value, const Schema& schema, const std::string& path, std::vector<ValidationError>& errors);
  std::shared_ptr<Schema> parseSchema(const Napi::Object& schemaObj);

  // Schema class with optimized memory layout and validation methods
  class Schema {
  public:
    std::string type;
    bool required = false;
    int minLength = -1;
    int maxLength = -1;
    double minimum = -std::numeric_limits<double>::infinity();
    double maximum = std::numeric_limits<double>::infinity();
    std::string pattern;
    std::unordered_map<std::string, std::shared_ptr<Schema>> properties;
    std::vector<std::string> requiredProperties;
    std::shared_ptr<Schema> items;

    // Optimized validation methods
    bool validateString(const std::string& value, const std::string& path, std::vector<ValidationError>& errors) const {
      size_t length = value.length();

      // Check minLength
      if (minLength >= 0 && length < static_cast<size_t>(minLength)) {
        errors.push_back({path, "String too short"});
        return false;
      }

      // Check maxLength
      if (maxLength >= 0 && length > static_cast<size_t>(maxLength)) {
        errors.push_back({path, "String too long"});
        return false;
      }

      // Check pattern
      if (!pattern.empty() && value.find(pattern) == std::string::npos) {
        errors.push_back({path, "String does not match pattern"});
        return false;
      }

      return true;
    }

    bool validateNumber(double value, const std::string& path, std::vector<ValidationError>& errors) const {
      // Check minimum
      if (value < minimum) {
        errors.push_back({path, "Number too small"});
        return false;
      }

      // Check maximum
      if (value > maximum) {
        errors.push_back({path, "Number too large"});
        return false;
      }

      return true;
    }

    bool validateObject(const Napi::Object& value, const std::string& path, std::vector<ValidationError>& errors) const {
      // Get property names
      Napi::Array propNames = value.GetPropertyNames();
      uint32_t propCount = propNames.Length();

      // Create a set of property names for faster lookup
      std::unordered_set<std::string> propSet;
      propSet.reserve(propCount);

      for (uint32_t i = 0; i < propCount; i++) {
        propSet.insert(propNames.Get(i).As<Napi::String>().Utf8Value());
      }

      // Check required properties
      for (const auto& prop : requiredProperties) {
        if (propSet.find(prop) == propSet.end()) {
          errors.push_back({path + "." + prop, "Required property missing"});
          return false;
        }
      }

      // Validate properties
      for (const auto& prop : properties) {
        if (value.HasOwnProperty(prop.first)) {
          validateValue(value.Get(prop.first), *prop.second, path + "." + prop.first, errors);
        }
      }

      return errors.empty();
    }

    bool validateArray(const Napi::Array& value, const std::string& path, std::vector<ValidationError>& errors) const {
      // Validate items if schema has items defined
      if (items) {
        uint32_t length = value.Length();
        std::string basePath = path + "[";

        for (uint32_t i = 0; i < length; i++) {
          std::string itemPath = basePath + std::to_string(i) + "]";
          validateValue(value.Get(i), *items, itemPath, errors);
        }
      }

      return errors.empty();
    }
  };

  // Helper functions
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

  // Parse schema object from JavaScript - optimized version
  std::shared_ptr<Schema> parseSchema(const Napi::Object& schemaObj) {
    auto schema = std::make_shared<Schema>();

    // Use HasOwnProperty for faster property checks
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

    if (schemaObj.HasOwnProperty("pattern") && schemaObj.Get("pattern").IsString()) {
      schema->pattern = schemaObj.Get("pattern").As<Napi::String>().Utf8Value();
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
          schema->properties[propName] = parseSchema(props.Get(propName).As<Napi::Object>());
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
      schema->items = parseSchema(schemaObj.Get("items").As<Napi::Object>());
    }

    return schema;
  }

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

  // Cache for parsed schemas to avoid repeated parsing
  std::unordered_map<std::string, std::shared_ptr<Schema>> schemaCache;

  Napi::Value Validate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsObject() || (!info[1].IsObject() && !info[1].IsArray())) {
      Napi::TypeError::New(env, "Expected (schema, data)").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object schemaObj = info[0].As<Napi::Object>();
    Napi::Value data = info[1];

    // Parse schema or use cached version
    std::shared_ptr<Schema> schema;

    // Check if we have a schema ID for caching
    std::string schemaId;
    if (schemaObj.HasOwnProperty("$id") && schemaObj.Get("$id").IsString()) {
      schemaId = schemaObj.Get("$id").As<Napi::String>().Utf8Value();

      // Try to find in cache
      auto it = schemaCache.find(schemaId);
      if (it != schemaCache.end()) {
        schema = it->second;
      } else {
        schema = parseSchema(schemaObj);
        // Store in cache if we have an ID
        if (!schemaId.empty()) {
          schemaCache[schemaId] = schema;
        }
      }
    } else {
      schema = parseSchema(schemaObj);
    }

    // Pre-allocate errors vector to reduce memory allocations
    std::vector<ValidationError> errors;
    errors.reserve(16);

    // Validate data
    validateValue(data, *schema, "$", errors);

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

  Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("validate", Napi::Function::New(env, Validate));
    return exports;
  }

} // namespace SchemaValidator
