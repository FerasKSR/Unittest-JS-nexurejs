#include "object_pool.h"
#include <cstring>
#include <algorithm>

// Initialize the ObjectPool class
Napi::Object ObjectPool::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "ObjectPool", {
    InstanceMethod("createObject", &ObjectPool::CreateObject),
    InstanceMethod("releaseObject", &ObjectPool::ReleaseObject),
    InstanceMethod("getHeadersObject", &ObjectPool::GetHeadersObject),
    InstanceMethod("releaseHeadersObject", &ObjectPool::ReleaseHeadersObject),
    InstanceMethod("getBuffer", &ObjectPool::GetBuffer),
    InstanceMethod("releaseBuffer", &ObjectPool::ReleaseBuffer),
    InstanceMethod("reset", &ObjectPool::Reset),
    InstanceMethod("getPoolInfo", &ObjectPool::GetPoolInfo)
  });

  exports.Set("ObjectPool", func);
  return exports;
}

// Constructor
ObjectPool::ObjectPool(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<ObjectPool>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Default configuration
  this->maxObjectPoolSize_ = 1000;
  this->maxBufferPoolSize_ = 1000;
  this->maxHeadersPoolSize_ = 1000;
  this->enabled_ = true;

  // Parse options if provided
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object options = info[0].As<Napi::Object>();

    if (options.Has("maxObjectPoolSize") && options.Get("maxObjectPoolSize").IsNumber()) {
      this->maxObjectPoolSize_ = options.Get("maxObjectPoolSize").As<Napi::Number>().Uint32Value();
    }

    if (options.Has("maxBufferPoolSize") && options.Get("maxBufferPoolSize").IsNumber()) {
      this->maxBufferPoolSize_ = options.Get("maxBufferPoolSize").As<Napi::Number>().Uint32Value();
    }

    if (options.Has("maxHeadersPoolSize") && options.Get("maxHeadersPoolSize").IsNumber()) {
      this->maxHeadersPoolSize_ = options.Get("maxHeadersPoolSize").As<Napi::Number>().Uint32Value();
    }

    if (options.Has("enabled") && options.Get("enabled").IsBoolean()) {
      this->enabled_ = options.Get("enabled").As<Napi::Boolean>().Value();
    }
  }

  // Reserve space for the pools
  this->objectPool_.reserve(this->maxObjectPoolSize_);
  this->bufferPool_.reserve(this->maxBufferPoolSize_);
  this->headersPool_.reserve(this->maxHeadersPoolSize_);

  // Initialize property definitions for fast object creation
  this->InitializePropertyDefinitions();
}

// Initialize property definitions for commonly used objects
void ObjectPool::InitializePropertyDefinitions() {
  Napi::Env env = Env();

  // Initialize getter/setter caches
  auto defineGetter = [&](const std::string& name, std::function<Napi::Value(const Napi::CallbackInfo&)> getter) {
    this->getterCache_[name] = Napi::Persistent(Napi::Function::New(env, getter));
  };

  auto defineSetter = [&](const std::string& name, std::function<void(const Napi::CallbackInfo&)> setter) {
    this->setterCache_[name] = Napi::Persistent(Napi::Function::New(env, setter));
  };

  defineGetter("method", [](const Napi::CallbackInfo& info) {
    Napi::Object self = info.This().As<Napi::Object>();
    return self.Get("_method");
  });

  defineSetter("method", [](const Napi::CallbackInfo& info) {
    if (info.Length() < 1) return;
    Napi::Object self = info.This().As<Napi::Object>();
    self.Set("_method", info[0]);
  });

  // Define more getters/setters for url, headers, etc.
  defineGetter("url", [](const Napi::CallbackInfo& info) {
    Napi::Object self = info.This().As<Napi::Object>();
    return self.Get("_url");
  });

  defineSetter("url", [](const Napi::CallbackInfo& info) {
    if (info.Length() < 1) return;
    Napi::Object self = info.This().As<Napi::Object>();
    self.Set("_url", info[0]);
  });

  defineGetter("headers", [](const Napi::CallbackInfo& info) {
    Napi::Object self = info.This().As<Napi::Object>();
    return self.Get("_headers");
  });

  defineSetter("headers", [](const Napi::CallbackInfo& info) {
    if (info.Length() < 1) return;
    Napi::Object self = info.This().As<Napi::Object>();
    self.Set("_headers", info[0]);
  });

  defineGetter("body", [](const Napi::CallbackInfo& info) {
    Napi::Object self = info.This().As<Napi::Object>();
    return self.Get("_body");
  });

  defineSetter("body", [](const Napi::CallbackInfo& info) {
    if (info.Length() < 1) return;
    Napi::Object self = info.This().As<Napi::Object>();
    self.Set("_body", info[0]);
  });

  defineGetter("query", [](const Napi::CallbackInfo& info) {
    Napi::Object self = info.This().As<Napi::Object>();
    return self.Get("_query");
  });

  defineSetter("query", [](const Napi::CallbackInfo& info) {
    if (info.Length() < 1) return;
    Napi::Object self = info.This().As<Napi::Object>();
    self.Set("_query", info[0]);
  });
}

// Create a new object from the pool or create one if the pool is empty
Napi::Value ObjectPool::CreateObject(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If disabled, just create a new object
  if (!this->enabled_) {
    return Napi::Object::New(env);
  }

  // Check if we have an available object in the pool
  for (auto& pooledObj : this->objectPool_) {
    if (!pooledObj.inUse) {
      // Mark as in use
      pooledObj.inUse = true;
      // Return the existing object
      return pooledObj.object.Value();
    }
  }

  // No available objects, check if we can add a new one to the pool
  if (this->objectPool_.size() < this->maxObjectPoolSize_) {
    // Create a new object
    Napi::Object obj = Napi::Object::New(env);

    // Store in pool - use emplace_back to construct in place
    this->objectPool_.emplace_back(PooledObject{
      Napi::Persistent(obj),
      true
    });

    return obj;
  }

  // Pool is full, create a temporary object (not pooled)
  return Napi::Object::New(env);
}

// Release an object back to the pool
Napi::Value ObjectPool::ReleaseObject(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // If disabled, do nothing
  if (!this->enabled_) {
    return env.Undefined();
  }

  Napi::Object obj = info[0].As<Napi::Object>();

  // Try to find the object in the pool
  for (auto& pooledObj : this->objectPool_) {
    if (pooledObj.inUse && pooledObj.object.Value() == obj) {
      // Reset object properties
      Napi::Object resetObj = pooledObj.object.Value();

      // Clear all properties by setting them to undefined or default values
      if (resetObj.Has("method")) resetObj.Set("method", env.Null());
      if (resetObj.Has("url")) resetObj.Set("url", env.Null());
      if (resetObj.Has("headers")) resetObj.Set("headers", Napi::Object::New(env));
      if (resetObj.Has("body")) resetObj.Set("body", env.Null());

      // Mark as available
      pooledObj.inUse = false;
      break;
    }
  }

  return env.Undefined();
}

// Get a headers object from the pool
Napi::Value ObjectPool::GetHeadersObject(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If disabled, just create a new object
  if (!this->enabled_) {
    return Napi::Object::New(env);
  }

  // Check if we have an available headers object in the pool
  for (auto& pooledObj : this->headersPool_) {
    if (!pooledObj.inUse) {
      // Mark as in use
      pooledObj.inUse = true;
      // Return the existing object
      return pooledObj.object.Value();
    }
  }

  // No available objects, check if we can add a new one to the pool
  if (this->headersPool_.size() < this->maxHeadersPoolSize_) {
    // Create a new headers object
    Napi::Object obj = Napi::Object::New(env);

    // Store in pool - use emplace_back to construct in place
    this->headersPool_.emplace_back(PooledObject{
      Napi::Persistent(obj),
      true
    });

    return obj;
  }

  // Pool is full, create a temporary object (not pooled)
  return Napi::Object::New(env);
}

// Release a headers object back to the pool
Napi::Value ObjectPool::ReleaseHeadersObject(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // If disabled, do nothing
  if (!this->enabled_) {
    return env.Undefined();
  }

  Napi::Object obj = info[0].As<Napi::Object>();

  // Try to find the headers object in the pool
  for (auto& pooledObj : this->headersPool_) {
    if (pooledObj.inUse && pooledObj.object.Value() == obj) {
      // Clear all properties
      Napi::Object resetObj = pooledObj.object.Value();

      // Get all property names
      Napi::Array propNames = resetObj.GetPropertyNames();
      for (uint32_t i = 0; i < propNames.Length(); i++) {
        Napi::Value key = propNames.Get(i);
        resetObj.Delete(key.ToString());
      }

      // Mark as available
      pooledObj.inUse = false;
      break;
    }
  }

  return env.Undefined();
}

// Get a buffer from the pool
Napi::Value ObjectPool::GetBuffer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Buffer size (number) expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  size_t size = info[0].As<Napi::Number>().Uint32Value();

  // If disabled, just create a new buffer
  if (!this->enabled_) {
    return Napi::Buffer<char>::New(env, size);
  }

  // Look for a buffer of appropriate size
  for (auto& pooledBuf : this->bufferPool_) {
    if (!pooledBuf.inUse && pooledBuf.size >= size) {
      // Mark as in use
      pooledBuf.inUse = true;
      // Return the existing buffer
      return pooledBuf.buffer.Value();
    }
  }

  // No suitable buffer found, create a new one
  if (this->bufferPool_.size() < this->maxBufferPoolSize_) {
    // Create a new buffer - allocate a bit more for future use to reduce fragmentation
    size_t allocSize = std::max(size, static_cast<size_t>(4096));
    Napi::Buffer<char> buffer = Napi::Buffer<char>::New(env, allocSize);

    // Store in pool - use emplace_back to construct in place
    this->bufferPool_.emplace_back(PooledBuffer{
      Napi::Persistent(buffer),
      allocSize,
      true
    });

    return buffer;
  }

  // Pool is full, create a temporary buffer (not pooled)
  return Napi::Buffer<char>::New(env, size);
}

// Release a buffer back to the pool
Napi::Value ObjectPool::ReleaseBuffer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // If disabled, do nothing
  if (!this->enabled_) {
    return env.Undefined();
  }

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();

  // Try to find the buffer in the pool
  for (auto& pooledBuf : this->bufferPool_) {
    if (pooledBuf.inUse && pooledBuf.buffer.Value() == buffer) {
      // Mark as available
      pooledBuf.inUse = false;
      break;
    }
  }

  return env.Undefined();
}

// Reset all pools
Napi::Value ObjectPool::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  ClearObjectPool();
  ClearBufferPool();
  ClearHeadersPool();

  return env.Undefined();
}

// Clear the object pool
void ObjectPool::ClearObjectPool() {
  objectPool_.clear();
}

// Clear the buffer pool
void ObjectPool::ClearBufferPool() {
  bufferPool_.clear();
}

// Clear the headers pool
void ObjectPool::ClearHeadersPool() {
  headersPool_.clear();
}

// Get information about the pools
Napi::Value ObjectPool::GetPoolInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Count in-use objects
  size_t objectsInUse = 0;
  for (const auto& obj : objectPool_) {
    if (obj.inUse) objectsInUse++;
  }

  size_t buffersInUse = 0;
  for (const auto& buf : bufferPool_) {
    if (buf.inUse) buffersInUse++;
  }

  size_t headersInUse = 0;
  for (const auto& hdr : headersPool_) {
    if (hdr.inUse) headersInUse++;
  }

  // Create result object
  Napi::Object result = Napi::Object::New(env);

  result.Set("enabled", Napi::Boolean::New(env, enabled_));

  Napi::Object objects = Napi::Object::New(env);
  objects.Set("total", Napi::Number::New(env, objectPool_.size()));
  objects.Set("inUse", Napi::Number::New(env, objectsInUse));
  objects.Set("available", Napi::Number::New(env, objectPool_.size() - objectsInUse));
  objects.Set("maxSize", Napi::Number::New(env, maxObjectPoolSize_));
  result.Set("objects", objects);

  Napi::Object buffers = Napi::Object::New(env);
  buffers.Set("total", Napi::Number::New(env, bufferPool_.size()));
  buffers.Set("inUse", Napi::Number::New(env, buffersInUse));
  buffers.Set("available", Napi::Number::New(env, bufferPool_.size() - buffersInUse));
  buffers.Set("maxSize", Napi::Number::New(env, maxBufferPoolSize_));
  result.Set("buffers", buffers);

  Napi::Object headers = Napi::Object::New(env);
  headers.Set("total", Napi::Number::New(env, headersPool_.size()));
  headers.Set("inUse", Napi::Number::New(env, headersInUse));
  headers.Set("available", Napi::Number::New(env, headersPool_.size() - headersInUse));
  headers.Set("maxSize", Napi::Number::New(env, maxHeadersPoolSize_));
  result.Set("headers", headers);

  return result;
}
