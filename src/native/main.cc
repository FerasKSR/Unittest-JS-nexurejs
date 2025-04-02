#include <napi.h>
#include "json/simdjson_wrapper.h"
#include "http/http_parser.h"
#include "http/object_pool.h"
#include "json/json_processor.h"
#include "routing/radix_router.h"
#include "url/url_parser.h"
#include "schema/schema_validator.h"
#include "compression/compression.h"
#include "websocket/websocket.h"
#include <mutex>
#include <vector>
#include <algorithm>

namespace nexurejs {

// Store references to constructors that need cleanup
std::vector<Napi::FunctionReference*> globalReferences;
std::mutex referencesMutex; // Protect access to globalReferences
bool isCleanupRegistered = false;
bool isCleanupExecuted = false;

// Store all initialized components for proper cleanup
struct Component {
    std::string name;
    std::function<void()> cleanup;
    bool cleanupCalled;
};
std::vector<Component> components;
std::mutex componentsMutex;

/**
 * Check if the native module is available
 */
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, true);
}

/**
 * Add a reference to the global list for cleanup
 */
void AddCleanupReference(Napi::FunctionReference* ref) {
  if (!ref) return;

  // Thread-safe access to shared vector
  std::lock_guard<std::mutex> lock(referencesMutex);

  // Only add to globalReferences if cleanup hasn't run yet
  if (!isCleanupExecuted) {
    globalReferences.push_back(ref);
  } else {
    // If cleanup already ran, delete immediately
    delete ref;
  }
}

/**
 * Register a component with cleanup function
 */
void RegisterComponent(const std::string& name, std::function<void()> cleanup) {
    std::lock_guard<std::mutex> lock(componentsMutex);

    // Check if component already registered
    auto it = std::find_if(components.begin(), components.end(),
        [&name](const Component& c) { return c.name == name; });

    if (it == components.end()) {
        // Add new component
        components.push_back({name, cleanup, false});
    } else {
        // Update existing component
        it->cleanup = cleanup;
        it->cleanupCalled = false;
    }
}

/**
 * Initialize the NexureJS native module
 * This file serves as the entry point for the native module
 * It initializes all the native components and exports them
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Initialize simdjson
  simdjson::builtin_implementation();

  // Initialize all components
  HttpParser::Init(env, exports);
  ObjectPool::Init(env, exports);
  RadixRouter::Init(env, exports);
  JsonProcessor::Init(env, exports);
  UrlParser::Init(env, exports);
  SchemaValidator::Init(env, exports);
  Compression::Init(env, exports);
  InitWebSocket(env, exports);

  // Register component cleanup functions
  RegisterComponent("HttpParser", []() { /* Cleanup code if needed */ });
  RegisterComponent("ObjectPool", []() { /* Cleanup code if needed */ });
  RegisterComponent("RadixRouter", []() { /* Cleanup code if needed */ });
  RegisterComponent("JsonProcessor", []() { /* Cleanup code if needed */ });
  RegisterComponent("UrlParser", []() { /* Cleanup code if needed */ });
  RegisterComponent("SchemaValidator", []() {
    // We'll handle this specially to avoid double free
    static std::once_flag cleanupFlag;
    std::call_once(cleanupFlag, []() {
      try {
        SchemaValidator::Cleanup();
      } catch (...) {
        // Ignore errors in cleanup
      }
    });
  });
  RegisterComponent("Compression", []() { /* Cleanup code if needed */ });
  RegisterComponent("WebSocket", []() { /* Cleanup code for WebSocket */ });

  // Export version information
  exports.Set("version", Napi::String::New(env, "0.1.9"));
  exports.Set("isNative", Napi::Boolean::New(env, true));

  // Export isAvailable function
  exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));

  return exports;
}

/**
 * Cleanup resources when the module is unloaded
 */
void Cleanup(void* arg) {
    try {
        // First clean up components with their specific cleanup logic
        {
            std::lock_guard<std::mutex> lock(componentsMutex);

            for (auto& component : components) {
                try {
                    if (component.cleanup && !component.cleanupCalled) {
                        component.cleanup();
                        component.cleanupCalled = true;
                    }
                } catch (...) {
                    // Ignore exceptions during cleanup
                }
            }

            components.clear();
        }

        // Then clean up global references
        {
            std::lock_guard<std::mutex> lock(referencesMutex);

            // Mark cleanup as executed to prevent double cleanup
            if (isCleanupExecuted) return;
            isCleanupExecuted = true;

            // Free global references
            for (auto ref : globalReferences) {
                if (ref) {
                    delete ref;
                }
            }

            globalReferences.clear();
        }
    } catch (...) {
        // Ensure cleanup doesn't throw
    }
}

} // namespace nexurejs

// Register the module with Node.js
napi_value init(napi_env env, napi_value exports) {
  Napi::Env napi_env(env);
  Napi::Object napi_exports = Napi::Object(napi_env, exports);

  // Register cleanup handler only once
  if (!nexurejs::isCleanupRegistered) {
    napi_add_env_cleanup_hook(env, nexurejs::Cleanup, nullptr);
    nexurejs::isCleanupRegistered = true;
  }

  return nexurejs::Init(napi_env, napi_exports);
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
