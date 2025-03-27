#pragma once

#include <napi.h>
#include <vector>
#include <unordered_map>
#include <string>
#include <memory>

/**
 * Object Pool for HTTP Components
 *
 * This class implements a generic object pool that can be used to reduce
 * memory allocations for frequently used objects in HTTP parsing/handling.
 */
class ObjectPool : public Napi::ObjectWrap<ObjectPool> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  ObjectPool(const Napi::CallbackInfo& info);

private:
  // Main object pool methods
  Napi::Value CreateObject(const Napi::CallbackInfo& info);
  Napi::Value ReleaseObject(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  Napi::Value GetPoolInfo(const Napi::CallbackInfo& info);

  // Header object pool methods
  Napi::Value GetHeadersObject(const Napi::CallbackInfo& info);
  Napi::Value ReleaseHeadersObject(const Napi::CallbackInfo& info);

  // Buffer pool methods
  Napi::Value GetBuffer(const Napi::CallbackInfo& info);
  Napi::Value ReleaseBuffer(const Napi::CallbackInfo& info);

  // Internal helper methods
  void ClearObjectPool();
  void ClearBufferPool();
  void ClearHeadersPool();
  void InitializePropertyDefinitions();

  // Pool storage
  struct PooledObject {
    Napi::ObjectReference object;
    bool inUse;
  };

  struct PooledBuffer {
    Napi::Reference<Napi::Buffer<char>> buffer;
    size_t size;
    bool inUse;
  };

  // Object pools
  std::vector<PooledObject> objectPool_;
  std::vector<PooledBuffer> bufferPool_;
  std::vector<PooledObject> headersPool_;

  // Configuration
  size_t maxObjectPoolSize_;
  size_t maxBufferPoolSize_;
  size_t maxHeadersPoolSize_;
  bool enabled_;

  // Pre-defined property definitions for fast object initialization
  std::vector<Napi::Object> propertyDefinitions_;

  // Cache of property definitions
  std::unordered_map<std::string, Napi::FunctionReference> getterCache_;
  std::unordered_map<std::string, Napi::FunctionReference> setterCache_;
};
