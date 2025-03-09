#ifndef RADIX_ROUTER_H
#define RADIX_ROUTER_H

#include <napi.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

// Node in the radix tree
class RadixNode {
public:
  RadixNode();
  ~RadixNode();

  // Node properties
  std::string path;
  std::unordered_map<std::string, Napi::ObjectReference> handlers;
  std::unordered_map<char, std::unique_ptr<RadixNode>> children;
  std::unique_ptr<RadixNode> paramChild;
  std::unique_ptr<RadixNode> wildcardChild;
  std::string paramName;
  bool isWildcard;
  bool hasHandler;

  // Bitmap for fast child lookup (ASCII)
  uint64_t staticChildrenBitmap[4] = {0}; // 256 bits total

  // Set bit in bitmap for a character
  void setBit(char c);

  // Check if bit is set for a character
  bool hasBit(char c) const;
};

class RadixRouter : public Napi::ObjectWrap<RadixRouter> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env);
  RadixRouter(const Napi::CallbackInfo& info);
  ~RadixRouter();

private:
  // JavaScript accessible methods
  Napi::Value Add(const Napi::CallbackInfo& info);
  Napi::Value Find(const Napi::CallbackInfo& info);
  Napi::Value Remove(const Napi::CallbackInfo& info);

  // Internal methods
  void Insert(const std::string& method, const std::string& path, const Napi::Object& handler);
  Napi::Value Lookup(const std::string& method, const std::string& path);

  // Root node of the radix tree
  std::unique_ptr<RadixNode> root_;

  // Cache for route lookups
  std::unordered_map<std::string, Napi::ObjectReference> routeCache_;
  size_t cacheSize_;
  size_t maxCacheSize_;

  // Reference to the Napi environment
  Napi::Env env_;
};

#endif // RADIX_ROUTER_H
