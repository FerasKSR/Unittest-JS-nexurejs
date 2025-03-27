#pragma once
#include <napi.h>
#include <uv.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <queue>
#include <mutex>
#include <atomic>
#include <thread>

// Forward declaration of WebSocketServer class
class WebSocketServer;

namespace nexurejs {
  // Forward declaration
  void AddCleanupReference(Napi::FunctionReference* ref);
}

/**
 * Initialize the WebSocket native module
 * @param env The NAPI environment
 * @param exports The exports object
 * @returns The exports object with WebSocket methods
 */
Napi::Object InitWebSocket(Napi::Env env, Napi::Object exports);
