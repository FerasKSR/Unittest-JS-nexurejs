#include "radix_router.h"
#include <algorithm>
#include <sstream>

// RadixNode implementation
RadixNode::RadixNode() : isWildcard(false), hasHandler(false) {}

RadixNode::~RadixNode() {}

void RadixNode::setBit(char c) {
  unsigned char uc = static_cast<unsigned char>(c);
  staticChildrenBitmap[uc >> 6] |= (1ULL << (uc & 63));
}

bool RadixNode::hasBit(char c) const {
  unsigned char uc = static_cast<unsigned char>(c);
  return (staticChildrenBitmap[uc >> 6] & (1ULL << (uc & 63))) != 0;
}

// RadixRouter implementation
Napi::Object RadixRouter::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "RadixRouter", {
    InstanceMethod("add", &RadixRouter::Add),
    InstanceMethod("find", &RadixRouter::Find),
    InstanceMethod("remove", &RadixRouter::Remove)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("RadixRouter", func);
  return exports;
}

Napi::Object RadixRouter::NewInstance(Napi::Env env) {
  Napi::EscapableHandleScope scope(env);
  Napi::FunctionReference* constructor = env.GetInstanceData<Napi::FunctionReference>();
  return scope.Escape(constructor->New({})).ToObject();
}

RadixRouter::RadixRouter(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<RadixRouter>(info), cacheSize_(0), maxCacheSize_(10000), env_(info.Env()) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Create root node
  root_ = std::make_unique<RadixNode>();

  // Parse options if provided
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object options = info[0].As<Napi::Object>();

    if (options.Has("maxCacheSize") && options.Get("maxCacheSize").IsNumber()) {
      maxCacheSize_ = options.Get("maxCacheSize").As<Napi::Number>().Uint32Value();
    }
  }
}

RadixRouter::~RadixRouter() {
  // Clear route cache to release JavaScript references
  routeCache_.clear();
}

// Add a route to the router
Napi::Value RadixRouter::Add(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsObject()) {
    Napi::TypeError::New(env, "Expected method (string), path (string), and handler (object)").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string method = info[0].As<Napi::String>().Utf8Value();
  std::string path = info[1].As<Napi::String>().Utf8Value();
  Napi::Object handler = info[2].As<Napi::Object>();

  // Normalize path
  if (path.empty() || path[0] != '/') {
    path = "/" + path;
  }

  // Insert the route
  Insert(method, path, handler);

  // Clear the route cache when adding new routes
  routeCache_.clear();
  cacheSize_ = 0;

  return info.This();
}

// Find a route handler
Napi::Value RadixRouter::Find(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Expected method (string) and path (string)").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string method = info[0].As<Napi::String>().Utf8Value();
  std::string path = info[1].As<Napi::String>().Utf8Value();

  // Normalize path
  if (path.empty() || path[0] != '/') {
    path = "/" + path;
  }

  // Create cache key
  std::string cacheKey = method + ":" + path;

  // Check cache first
  auto cacheIt = routeCache_.find(cacheKey);
  if (cacheIt != routeCache_.end()) {
    return cacheIt->second.Value();
  }

  // Lookup the route
  return Lookup(method, path);
}

// Remove a route
Napi::Value RadixRouter::Remove(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Expected method (string) and path (string)").ThrowAsJavaScriptException();
    return env.Boolean(false);
  }

  std::string method = info[0].As<Napi::String>().Utf8Value();
  std::string path = info[1].As<Napi::String>().Utf8Value();

  // Normalize path
  if (path.empty() || path[0] != '/') {
    path = "/" + path;
  }

  // Find the node
  RadixNode* node = root_.get();
  std::string remaining = path;

  while (!remaining.empty() && node) {
    char firstChar = remaining[0];

    if (firstChar == ':') {
      // Parameter node
      if (!node->paramChild) {
        return env.Boolean(false);
      }

      // Extract parameter name
      size_t paramEnd = remaining.find('/', 1);
      if (paramEnd == std::string::npos) {
        paramEnd = remaining.length();
      }

      // Move to parameter child
      node = node->paramChild.get();
      remaining = paramEnd < remaining.length() ? remaining.substr(paramEnd) : "";
    } else if (firstChar == '*') {
      // Wildcard node
      if (!node->wildcardChild) {
        return env.Boolean(false);
      }

      // Move to wildcard child
      node = node->wildcardChild.get();
      remaining = "";
    } else {
      // Static node - find the longest common prefix
      if (!node->hasBit(firstChar)) {
        return env.Boolean(false);
      }

      auto it = node->children.find(firstChar);
      if (it == node->children.end()) {
        return env.Boolean(false);
      }

      RadixNode* child = it->second.get();

      // Find common prefix length
      size_t i = 0;
      size_t max = std::min(child->path.length(), remaining.length());
      while (i < max && child->path[i] == remaining[i]) {
        i++;
      }

      if (i < child->path.length()) {
        // Partial match, not found
        return env.Boolean(false);
      }

      // Move to child node
      node = child;
      remaining = remaining.substr(i);
    }
  }

  // Check if we found the node and it has a handler for this method
  if (node && node->hasHandler && node->handlers.find(method) != node->handlers.end()) {
    // Remove the handler
    node->handlers.erase(method);

    // Update hasHandler flag
    node->hasHandler = !node->handlers.empty();

    // Clear the route cache
    routeCache_.clear();
    cacheSize_ = 0;

    return env.Boolean(true);
  }

  return env.Boolean(false);
}

// Insert a route into the radix tree
void RadixRouter::Insert(const std::string& method, const std::string& path, const Napi::Object& handler) {
  RadixNode* node = root_.get();
  std::string remaining = path;

  while (!remaining.empty()) {
    char firstChar = remaining[0];

    if (firstChar == ':') {
      // Parameter node
      if (!node->paramChild) {
        node->paramChild = std::make_unique<RadixNode>();
      }

      // Extract parameter name
      size_t paramEnd = remaining.find('/', 1);
      if (paramEnd == std::string::npos) {
        paramEnd = remaining.length();
      }

      // Set parameter name
      node->paramChild->paramName = remaining.substr(1, paramEnd - 1);

      // Move to parameter child
      node = node->paramChild.get();
      remaining = paramEnd < remaining.length() ? remaining.substr(paramEnd) : "";
    } else if (firstChar == '*') {
      // Wildcard node
      if (!node->wildcardChild) {
        node->wildcardChild = std::make_unique<RadixNode>();
        node->wildcardChild->isWildcard = true;
      }

      // Extract wildcard name if present
      if (remaining.length() > 1) {
        node->wildcardChild->paramName = remaining.substr(1);
      }

      // Move to wildcard child
      node = node->wildcardChild.get();
      remaining = "";
    } else {
      // Static node
      if (!node->hasBit(firstChar)) {
        // No child with this starting character, create a new one
        node->setBit(firstChar);
        auto newChild = std::make_unique<RadixNode>();
        newChild->path = remaining;
        node->children[firstChar] = std::move(newChild);
        node = node->children[firstChar].get();
        remaining = "";
      } else {
        // Child exists, find it
        auto it = node->children.find(firstChar);
        if (it == node->children.end()) {
          // This shouldn't happen if bitmap is correct
          throw std::runtime_error("Bitmap inconsistency");
        }

        RadixNode* child = it->second.get();

        // Find common prefix length
        size_t i = 0;
        size_t max = std::min(child->path.length(), remaining.length());
        while (i < max && child->path[i] == remaining[i]) {
          i++;
        }

        if (i < child->path.length()) {
          // Split the node
          auto newChild = std::make_unique<RadixNode>();
          newChild->path = child->path.substr(i);
          newChild->children = std::move(child->children);
          newChild->paramChild = std::move(child->paramChild);
          newChild->wildcardChild = std::move(child->wildcardChild);
          newChild->handlers = std::move(child->handlers);
          newChild->hasHandler = child->hasHandler;

          // Update the current child
          child->path = child->path.substr(0, i);
          child->hasHandler = false;
          child->handlers.clear();

          // Set bitmap for the first character of the new path
          if (!newChild->path.empty()) {
            child->setBit(newChild->path[0]);
            child->children[newChild->path[0]] = std::move(newChild);
          }
        }

        // Move to child node
        node = child;
        remaining = remaining.substr(i);
      }
    }
  }

  // Store the handler
  node->hasHandler = true;
  node->handlers[method] = Napi::Persistent(handler);
}

// Lookup a route in the radix tree
Napi::Value RadixRouter::Lookup(const std::string& method, const std::string& path) {
  Napi::Env env = env_;

  // Create cache key
  std::string cacheKey = method + ":" + path;

  // Create result object
  Napi::Object result = Napi::Object::New(env);
  Napi::Object params = Napi::Object::New(env);
  result.Set("params", params);

  // Start at the root
  RadixNode* node = root_.get();
  std::string remaining = path;

  // Track matched handlers for wildcard fallback
  struct MatchedHandler {
    RadixNode* node;
    size_t paramsCount;
  };

  std::vector<MatchedHandler> matchedHandlers;

  while (!remaining.empty() && node) {
    char firstChar = remaining[0];

    // Try static routes first (most specific)
    if (node->hasBit(firstChar)) {
      auto it = node->children.find(firstChar);
      if (it != node->children.end()) {
        RadixNode* child = it->second.get();

        // Check if the path matches
        if (remaining.length() >= child->path.length() &&
            remaining.substr(0, child->path.length()) == child->path) {
          // Move to child node
          node = child;
          remaining = remaining.substr(child->path.length());
          continue;
        }
      }
    }

    // Try parameter routes next
    if (node->paramChild) {
      // Extract parameter value
      size_t paramEnd = remaining.find('/', 1);
      if (paramEnd == std::string::npos) {
        paramEnd = remaining.length();
      }

      std::string paramValue = remaining.substr(0, paramEnd);

      // Store parameter
      params.Set(node->paramChild->paramName, Napi::String::New(env, paramValue));

      // Move to parameter child
      node = node->paramChild.get();
      remaining = paramEnd < remaining.length() ? remaining.substr(paramEnd) : "";

      // If this node has a handler, track it as a potential match
      if (node->hasHandler) {
        matchedHandlers.push_back({node, params.GetPropertyNames().Length()});
      }

      continue;
    }

    // Try wildcard routes last (least specific)
    if (node->wildcardChild) {
      // Store wildcard parameter if it has a name
      if (!node->wildcardChild->paramName.empty()) {
        params.Set(node->wildcardChild->paramName, Napi::String::New(env, remaining));
      }

      // Move to wildcard child
      node = node->wildcardChild.get();
      remaining = "";

      // If this node has a handler, track it as a potential match
      if (node->hasHandler) {
        matchedHandlers.push_back({node, params.GetPropertyNames().Length()});
      }

      continue;
    }

    // No match found
    break;
  }

  // Check if we found an exact match
  if (remaining.empty() && node && node->hasHandler) {
    auto handlerIt = node->handlers.find(method);
    if (handlerIt != node->handlers.end()) {
      // Found an exact match
      result.Set("handler", handlerIt->second.Value());
      result.Set("found", Napi::Boolean::New(env, true));

      // Cache the result if cache isn't full
      if (cacheSize_ < maxCacheSize_) {
        routeCache_[cacheKey] = Napi::Persistent(result);
        cacheSize_++;
      }

      return result;
    }
  }

  // Check for matched handlers (from most to least specific)
  std::sort(matchedHandlers.begin(), matchedHandlers.end(),
            [](const MatchedHandler& a, const MatchedHandler& b) {
              return a.paramsCount > b.paramsCount;
            });

  for (const auto& match : matchedHandlers) {
    auto handlerIt = match.node->handlers.find(method);
    if (handlerIt != match.node->handlers.end()) {
      // Found a match
      result.Set("handler", handlerIt->second.Value());
      result.Set("found", Napi::Boolean::New(env, true));

      // Cache the result if cache isn't full
      if (cacheSize_ < maxCacheSize_) {
        routeCache_[cacheKey] = Napi::Persistent(result);
        cacheSize_++;
      }

      return result;
    }
  }

  // No handler found
  result.Set("found", Napi::Boolean::New(env, false));
  return result;
}
