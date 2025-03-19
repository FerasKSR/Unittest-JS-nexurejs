#pragma once
#include <napi.h>

// Forward declaration of WebSocketServer class
class WebSocketServer;

/**
 * Initialize the WebSocket native module
 * @param env The NAPI environment
 * @param exports The exports object
 * @returns The exports object with WebSocket methods
 */
Napi::Object InitWebSocket(Napi::Env env, Napi::Object exports);
