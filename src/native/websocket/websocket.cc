#include <napi.h>
#include <uv.h>
#include <unordered_map>
#include <string>
#include <vector>
#include <memory>
#include <mutex>
#include <queue>
#include <algorithm>
#include <chrono>
#include <atomic>

// WebSocket frame opcodes
#define WS_CONTINUATION 0x0
#define WS_TEXT 0x1
#define WS_BINARY 0x2
#define WS_CLOSE 0x8
#define WS_PING 0x9
#define WS_PONG 0xA

// Forward declarations
class WebSocketConnection;
class WebSocketRoom;
class WebSocketServer;

// WebSocket connection class
class WebSocketConnection {
public:
    WebSocketConnection(uv_tcp_t* client, WebSocketServer* server);
    ~WebSocketConnection();

    void Send(const std::string& message);
    void SendBinary(const void* data, size_t length);
    void Close(uint16_t code = 1000, const std::string& reason = "");
    void JoinRoom(const std::string& roomName);
    void LeaveRoom(const std::string& roomName);
    void LeaveAllRooms();
    bool IsInRoom(const std::string& roomName) const;
    std::vector<std::string> GetRooms() const;
    void Ping();

    // Getters
    uint64_t GetId() const { return id_; }
    bool IsAlive() const { return isAlive_; }
    bool IsAuthenticated() const { return isAuthenticated_; }
    uint64_t GetLastActivity() const { return lastActivity_; }
    size_t GetBytesSent() const { return bytesSent_; }
    size_t GetBytesReceived() const { return bytesReceived_; }
    std::chrono::steady_clock::time_point GetConnectTime() const { return connectTime_; }

    // Setters
    void SetAlive(bool alive) { isAlive_ = alive; }
    void SetAuthenticated(bool authenticated) { isAuthenticated_ = authenticated; }
    void SetData(const std::string& key, const Napi::Value& value);
    Napi::Value GetData(const std::string& key, Napi::Env env) const;
    void UpdateActivity() {
        lastActivity_ = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
    }

private:
    static void AllocBuffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
    static void OnRead(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf);
    static void OnClose(uv_handle_t* handle);
    static void AfterWrite(uv_write_t* req, int status);

    void HandleFrame(const uint8_t* frame, size_t length);
    void HandleMessage(const std::string& message);
    void HandleBinaryMessage(const void* data, size_t length);
    void HandlePing(const void* data, size_t length);
    void HandlePong();
    void HandleClose(uint16_t code, const std::string& reason);
    void SendFrame(uint8_t opcode, const void* data, size_t length, bool mask = false);

    uint64_t id_;
    uv_tcp_t* client_;
    WebSocketServer* server_;
    bool isAlive_;
    bool isAuthenticated_ = false;
    std::vector<std::string> rooms_;
    std::unordered_map<std::string, Napi::Reference<Napi::Value>> userData_;
    std::mutex mutex_;
    uint64_t lastActivity_;
    size_t bytesSent_ = 0;
    size_t bytesReceived_ = 0;
    std::chrono::steady_clock::time_point connectTime_;
};

// WebSocket room class
class WebSocketRoom {
public:
    WebSocketRoom(const std::string& name);
    ~WebSocketRoom();

    void AddConnection(WebSocketConnection* connection);
    void RemoveConnection(WebSocketConnection* connection);
    void Broadcast(const std::string& message, WebSocketConnection* exclude = nullptr);
    void BroadcastBinary(const void* data, size_t length, WebSocketConnection* exclude = nullptr);
    size_t GetConnectionCount() const;
    std::vector<WebSocketConnection*> GetConnections() const;
    std::vector<WebSocketConnection*> GetAuthenticatedConnections() const;
    void StoreMessage(const std::string& message, size_t maxHistory = 100);
    std::vector<std::string> GetMessageHistory() const;

    // Getters
    std::string GetName() const { return name_; }
    size_t GetMaxSize() const { return maxSize_; }

    // Setters
    void SetMaxSize(size_t size) { maxSize_ = size; }

private:
    std::string name_;
    std::vector<WebSocketConnection*> connections_;
    mutable std::mutex mutex_;
    std::deque<std::string> messageHistory_;
    size_t maxSize_ = 0; // 0 means unlimited
};

// WebSocket server class
class WebSocketServer : public Napi::ObjectWrap<WebSocketServer> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    WebSocketServer(const Napi::CallbackInfo& info);
    ~WebSocketServer();

    // JavaScript accessible methods
    void Start(const Napi::CallbackInfo& info);
    void Stop(const Napi::CallbackInfo& info);
    void Send(const Napi::CallbackInfo& info);
    void SendBinary(const Napi::CallbackInfo& info);
    void Broadcast(const Napi::CallbackInfo& info);
    void BroadcastBinary(const Napi::CallbackInfo& info);
    void CloseConnection(const Napi::CallbackInfo& info);
    void JoinRoom(const Napi::CallbackInfo& info);
    void LeaveRoom(const Napi::CallbackInfo& info);
    void LeaveAllRooms(const Napi::CallbackInfo& info);
    Napi::Value IsInRoom(const Napi::CallbackInfo& info);
    Napi::Value GetConnectionRooms(const Napi::CallbackInfo& info);
    Napi::Value GetRooms(const Napi::CallbackInfo& info);
    Napi::Value GetRoomSize(const Napi::CallbackInfo& info);
    Napi::Value GetRoomConnections(const Napi::CallbackInfo& info);
    Napi::Value GetConnectionCount(const Napi::CallbackInfo& info);
    void BroadcastToRoom(const Napi::CallbackInfo& info);
    void BroadcastBinaryToRoom(const Napi::CallbackInfo& info);
    void Ping(const Napi::CallbackInfo& info);
    Napi::Value GetRoomHistory(const Napi::CallbackInfo& info);
    void SetMaxRoomSize(const Napi::CallbackInfo& info);
    void SetMaxConnections(const Napi::CallbackInfo& info);
    void SetAuthenticated(const Napi::CallbackInfo& info);
    Napi::Value GetConnectionStats(const Napi::CallbackInfo& info);
    void DisconnectInactiveConnections(const Napi::CallbackInfo& info);

    // Internal methods
    void OnConnection(uv_stream_t* server, int status);
    void OnMessage(WebSocketConnection* connection, const std::string& message);
    void OnBinaryMessage(WebSocketConnection* connection, const void* data, size_t length);
    void OnDisconnect(WebSocketConnection* connection, uint16_t code, const std::string& reason);
    void OnRoomJoin(WebSocketConnection* connection, const std::string& roomName);
    void OnRoomLeave(WebSocketConnection* connection, const std::string& roomName);
    void OnPing(WebSocketConnection* connection);
    void OnPong(WebSocketConnection* connection);
    void OnError(const std::string& error);

    // Helper methods
    void CloseConnectionById(uint64_t id, int code, const std::string& reason);

private:
    // Callback references
    Napi::FunctionReference onConnectionCallback_;
    Napi::FunctionReference onMessageCallback_;
    Napi::FunctionReference onBinaryMessageCallback_;
    Napi::FunctionReference onDisconnectCallback_;
    Napi::FunctionReference onErrorCallback_;
    Napi::FunctionReference onRoomJoinCallback_;
    Napi::FunctionReference onRoomLeaveCallback_;
    Napi::FunctionReference onPingCallback_;
    Napi::FunctionReference onPongCallback_;

    // Server state
    uv_tcp_t server_;
    std::unordered_map<uint64_t, std::unique_ptr<WebSocketConnection>> connections_;
    std::unordered_map<std::string, std::unique_ptr<WebSocketRoom>> rooms_;
    std::mutex mutex_;
    bool isRunning_ = false;
    std::atomic<size_t> maxConnections_ = 0; // 0 means unlimited

    // Helper methods
    WebSocketConnection* GetConnection(uint64_t id);
    WebSocketRoom* GetRoom(const std::string& name, bool create = true);
};

// Helper to convert C++ types to JavaScript
inline Napi::Value ToValue(Napi::Env env, const std::string& value) {
    return Napi::String::New(env, value);
}

inline Napi::Value ToValue(Napi::Env env, int value) {
    return Napi::Number::New(env, value);
}

inline Napi::Value ToValue(Napi::Env env, uint64_t value) {
    return Napi::Number::New(env, static_cast<double>(value));
}

inline Napi::Value ToValue(Napi::Env env, bool value) {
    return Napi::Boolean::New(env, value);
}

template <typename T>
inline Napi::Value ToValue(Napi::Env env, const std::vector<T>& values) {
    Napi::Array array = Napi::Array::New(env, values.size());
    for (size_t i = 0; i < values.size(); i++) {
        array[i] = ToValue(env, values[i]);
    }
    return array;
}

// Implementation of the WebSocketConnection class
WebSocketConnection::WebSocketConnection(uv_tcp_t* client, WebSocketServer* server)
    : client_(client),
      server_(server),
      isAlive_(true),
      isAuthenticated_(false),
      lastActivity_(std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count()),
      bytesSent_(0),
      bytesReceived_(0),
      connectTime_(std::chrono::steady_clock::now()) {
    // Generate a unique ID for this connection
    static std::atomic<uint64_t> nextId(1);
    id_ = nextId++;

    // Store the connection in the client data
    client_->data = this;

    // Set up the read callback
    uv_read_start(reinterpret_cast<uv_stream_t*>(client_), AllocBuffer, OnRead);
}

// Implementation of the ping method
void WebSocketConnection::Ping() {
    SendFrame(WS_PING, nullptr, 0, false);
}

// Implementation of message history for WebSocketRoom
void WebSocketRoom::StoreMessage(const std::string& message, size_t maxHistory) {
    std::lock_guard<std::mutex> lock(mutex_);
    messageHistory_.push_back(message);
    if (maxHistory > 0 && messageHistory_.size() > maxHistory) {
        messageHistory_.pop_front();
    }
}

std::vector<std::string> WebSocketRoom::GetMessageHistory() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return std::vector<std::string>(messageHistory_.begin(), messageHistory_.end());
}

// Implementation for getting authenticated connections
std::vector<WebSocketConnection*> WebSocketRoom::GetAuthenticatedConnections() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<WebSocketConnection*> authenticatedConnections;
    for (auto connection : connections_) {
        if (connection->IsAuthenticated()) {
            authenticatedConnections.push_back(connection);
        }
    }
    return authenticatedConnections;
}

// Implementation of new WebSocketServer methods
Napi::Value WebSocketServer::GetRoomHistory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::Error::New(env, "Room name is required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string roomName = info[0].As<Napi::String>().Utf8Value();
    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto it = rooms_.find(roomName);
        if (it == rooms_.end()) {
            return Napi::Array::New(env, 0);
        }

        return ToValue(env, it->second->GetMessageHistory());
    }

    return env.Undefined();
}

void WebSocketServer::SetMaxRoomSize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
        Napi::Error::New(env, "Room name and max size are required").ThrowAsJavaScriptException();
        return;
    }

    std::string roomName = info[0].As<Napi::String>().Utf8Value();
    size_t maxSize = info[1].As<Napi::Number>().Uint32Value();

    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto room = GetRoom(roomName, true);
        room->SetMaxSize(maxSize);
    }
}

void WebSocketServer::SetMaxConnections(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::Error::New(env, "Max connections is required").ThrowAsJavaScriptException();
        return;
    }

    maxConnections_ = info[0].As<Napi::Number>().Uint32Value();
}

void WebSocketServer::SetAuthenticated(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsBoolean()) {
        Napi::Error::New(env, "Connection ID and auth status are required").ThrowAsJavaScriptException();
        return;
    }

    uint64_t id = info[0].As<Napi::Number>().Int64Value();
    bool authenticated = info[1].As<Napi::Boolean>().Value();

    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto connection = GetConnection(id);
        if (connection) {
            connection->SetAuthenticated(authenticated);
        }
    }
}

Napi::Value WebSocketServer::GetConnectionStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Object stats = Napi::Object::New(env);

    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);

        size_t totalConnections = connections_.size();
        size_t authenticatedConnections = 0;
        uint64_t totalBytesSent = 0;
        uint64_t totalBytesReceived = 0;
        size_t roomCount = rooms_.size();

        for (const auto& pair : connections_) {
            if (pair.second->IsAuthenticated()) {
                authenticatedConnections++;
            }
            totalBytesSent += pair.second->GetBytesSent();
            totalBytesReceived += pair.second->GetBytesReceived();
        }

        stats.Set("totalConnections", Napi::Number::New(env, static_cast<double>(totalConnections)));
        stats.Set("authenticatedConnections", Napi::Number::New(env, static_cast<double>(authenticatedConnections)));
        stats.Set("totalBytesSent", Napi::Number::New(env, static_cast<double>(totalBytesSent)));
        stats.Set("totalBytesReceived", Napi::Number::New(env, static_cast<double>(totalBytesReceived)));
        stats.Set("roomCount", Napi::Number::New(env, static_cast<double>(roomCount)));
    }

    return stats;
}

void WebSocketServer::DisconnectInactiveConnections(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::Error::New(env, "Inactivity threshold (in ms) is required").ThrowAsJavaScriptException();
        return;
    }

    uint64_t threshold = info[0].As<Napi::Number>().Int64Value();
    uint64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::system_clock::now().time_since_epoch()).count();

    std::vector<uint64_t> toDisconnect;

    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        for (const auto& pair : connections_) {
            if (now - pair.second->GetLastActivity() > threshold) {
                toDisconnect.push_back(pair.first);
            }
        }
    }

    // Disconnect outside the lock to avoid deadlock
    for (uint64_t id : toDisconnect) {
        Napi::HandleScope scope(env);
        // Create a callback info object or use a helper method for close connection
        // For example, create a separate helper method:
        CloseConnectionById(id, 1001, "Connection timeout");
    }
}

void WebSocketServer::Ping(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::Error::New(env, "Connection ID is required").ThrowAsJavaScriptException();
        return;
    }

    uint64_t id = info[0].As<Napi::Number>().Int64Value();

    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto connection = GetConnection(id);
        if (connection) {
            connection->Ping();
        }
    }
}

// Add export initialization for all new methods
Napi::Object WebSocketServer::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "WebSocketServer", {
        // Existing methods
        InstanceMethod("start", &WebSocketServer::Start),
        InstanceMethod("stop", &WebSocketServer::Stop),
        InstanceMethod("send", &WebSocketServer::Send),
        InstanceMethod("sendBinary", &WebSocketServer::SendBinary),
        InstanceMethod("broadcast", &WebSocketServer::Broadcast),
        InstanceMethod("broadcastBinary", &WebSocketServer::BroadcastBinary),
        InstanceMethod("closeConnection", &WebSocketServer::CloseConnection),
        InstanceMethod("joinRoom", &WebSocketServer::JoinRoom),
        InstanceMethod("leaveRoom", &WebSocketServer::LeaveRoom),
        InstanceMethod("leaveAllRooms", &WebSocketServer::LeaveAllRooms),
        InstanceMethod("isInRoom", &WebSocketServer::IsInRoom),
        InstanceMethod("getConnectionRooms", &WebSocketServer::GetConnectionRooms),
        InstanceMethod("getRooms", &WebSocketServer::GetRooms),
        InstanceMethod("getRoomSize", &WebSocketServer::GetRoomSize),
        InstanceMethod("getRoomConnections", &WebSocketServer::GetRoomConnections),
        InstanceMethod("getConnectionCount", &WebSocketServer::GetConnectionCount),
        InstanceMethod("broadcastToRoom", &WebSocketServer::BroadcastToRoom),
        InstanceMethod("broadcastBinaryToRoom", &WebSocketServer::BroadcastBinaryToRoom),

        // New methods
        InstanceMethod("ping", &WebSocketServer::Ping),
        InstanceMethod("getRoomHistory", &WebSocketServer::GetRoomHistory),
        InstanceMethod("setMaxRoomSize", &WebSocketServer::SetMaxRoomSize),
        InstanceMethod("setMaxConnections", &WebSocketServer::SetMaxConnections),
        InstanceMethod("setAuthenticated", &WebSocketServer::SetAuthenticated),
        InstanceMethod("getConnectionStats", &WebSocketServer::GetConnectionStats),
        InstanceMethod("disconnectInactiveConnections", &WebSocketServer::DisconnectInactiveConnections)
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("WebSocketServer", func);
    return exports;
}

/**
 * Initialize the WebSocket native module
 * This is a wrapper around WebSocketServer::Init to match the header declaration
 */
Napi::Object InitWebSocket(Napi::Env env, Napi::Object exports) {
    return WebSocketServer::Init(env, exports);
}

// Add the CloseConnectionById helper method before the DisconnectInactiveConnections method
void WebSocketServer::CloseConnectionById(uint64_t id, int code, const std::string& reason) {
    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto connection = GetConnection(id);
        if (connection) {
            connection->Close(code, reason);
        }
    }
}

// In the GetConnection method:
WebSocketConnection* WebSocketServer::GetConnection(uint64_t id) {
    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto it = connections_.find(id);
        return it != connections_.end() ? it->second.get() : nullptr;
    }
    return nullptr;
}

// In the GetRoom method:
WebSocketRoom* WebSocketServer::GetRoom(const std::string& name, bool create) {
    if (auto* server = this) {
        std::lock_guard<std::mutex> lock(server->mutex_);
        auto it = rooms_.find(name);
        if (it == rooms_.end() && create) {
            auto room = std::make_unique<WebSocketRoom>(name);
            WebSocketRoom* roomPtr = room.get();
            rooms_[name] = std::move(room);
            return roomPtr;
        }
        return it != rooms_.end() ? it->second.get() : nullptr;
    }
    return nullptr;
}
