/**
 * WebSocketServer class implementation
 *
 * High-performance WebSocket server implementation using native C++ modules
 * with graceful fallback to JavaScript when native modules are not available.
 */

import { EventEmitter } from 'node:events';
import { Server as HttpServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { Logger } from '../../utils/logger.js';
import { loadNativeBinding } from '../loader.js';

// Define WebSocket connection interface
export interface WebSocketConnection {
  id: number;
  send(message: string | object): void;
  sendBinary(data: Buffer): void;
  close(code?: number, reason?: string): void;
  joinRoom(roomName: string): void;
  leaveRoom(roomName: string): void;
  leaveAllRooms(): void;
  isInRoom(roomName: string): boolean;
  getRooms(): string[];
  isAlive: boolean;
  isAuthenticated: boolean;
  user?: any;
  data: Record<string, any>;
  lastHeartbeat: number;
  ping(): void;
}

// Define WebSocket message interface
export interface WebSocketMessage {
  type: string;
  data: any;
  room?: string;
}

// Define authentication options
export interface WebSocketAuthOptions {
  /** Whether authentication is required (default: false) */
  required: boolean;

  /** Timeout in milliseconds to authenticate after connection (default: 10000) */
  timeout: number;

  /** Authentication handler function */
  handler: (token: string, connection: WebSocketConnection) => Promise<any>;
}

// Define heartbeat options
export interface WebSocketHeartbeatOptions {
  /** Whether to enable heartbeat (default: true) */
  enabled: boolean;

  /** Interval in milliseconds to send ping messages (default: 30000) */
  interval: number;

  /** Timeout in milliseconds to wait for pong response (default: 10000) */
  timeout: number;
}

// Define WebSocket server options
export interface WebSocketServerOptions {
  /** Authentication options */
  auth?: Partial<WebSocketAuthOptions>;

  /** Heartbeat options */
  heartbeat?: Partial<WebSocketHeartbeatOptions>;

  /** Maximum connections allowed (0 = unlimited, default: 0) */
  maxConnections?: number;

  /** Maximum clients per room (0 = unlimited, default: 0) */
  maxClientsPerRoom?: number;
}

// Define WebSocket event context
export interface WebSocketEventContext {
  connection: WebSocketConnection;
  message?: WebSocketMessage;
  room?: string;
  binary?: Buffer;
}

/**
 * WebSocket connection statistics interface
 */
export interface WebSocketConnectionStats {
  /** Total number of connections */
  totalConnections: number;

  /** Number of authenticated connections */
  authenticatedConnections: number;

  /** Total bytes sent */
  totalBytesSent: number;

  /** Total bytes received */
  totalBytesReceived: number;

  /** Number of rooms */
  roomCount: number;
}

/**
 * WebSocketServer class
 * High-performance WebSocket server implementation using native C++ modules
 */
export class WebSocketServer extends EventEmitter {
  private nativeServer: any;
  private logger: Logger;
  private isRunning: boolean = false;
  private connections: Map<number, WebSocketConnection> = new Map();
  private authOptions: WebSocketAuthOptions;
  private heartbeatOptions: WebSocketHeartbeatOptions;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private serverOptions: WebSocketServerOptions;

  // Add static reference to the native module
  private static nativeModule = loadNativeBinding()?.NativeWebSocketServer;

  // Add static performance metrics
  private static nativeTime = 0;
  private static nativeCount = 0;

  /**
   * Create a new WebSocket server
   * @param httpServer The HTTP server to attach to
   * @param options WebSocket server options
   */
  constructor(
    private httpServer: HttpServer,
    options: WebSocketServerOptions = {}
  ) {
    super();
    this.logger = new Logger();

    // Default options
    this.serverOptions = options;

    // Set up authentication options
    this.authOptions = {
      required: false,
      timeout: 10000,
      handler: async () => null,
      ...options.auth
    };

    // Set up heartbeat options
    this.heartbeatOptions = {
      enabled: true,
      interval: 30000,
      timeout: 10000,
      ...options.heartbeat
    };

    // Try to load native module
    const nativeModule = loadNativeBinding();

    if (!nativeModule?.NativeWebSocketServer) {
      throw new Error('Native WebSocket module not available');
    }

    // Create native server instance
    this.nativeServer = new nativeModule.NativeWebSocketServer({
      onConnection: this.handleConnection.bind(this),
      onMessage: this.handleMessage.bind(this),
      onBinaryMessage: this.handleBinaryMessage.bind(this),
      onDisconnect: this.handleDisconnect.bind(this),
      onError: this.handleError.bind(this),
      onRoomJoin: this.handleRoomJoin.bind(this),
      onRoomLeave: this.handleRoomLeave.bind(this),
      onPong: this.handlePong.bind(this)
    });
  }

  /**
   * Start the WebSocket server
   * @param port The port to listen on (optional, uses HTTP server port if not provided)
   */
  start(port?: number): void {
    if (this.isRunning) return;

    try {
      this.nativeServer.start({
        server: this.httpServer,
        port
      });

      this.isRunning = true;
      this.logger.info('Native WebSocket server started');

      // Start heartbeat mechanism if enabled
      if (this.heartbeatOptions.enabled) {
        this.startHeartbeat();
      }
    } catch (error) {
      this.logger.error('Failed to start native WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (!this.isRunning) return;

    try {
      // Stop heartbeat timer
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      this.nativeServer.stop();
      this.isRunning = false;
      this.logger.info('Native WebSocket server stopped');
    } catch (error) {
      this.logger.error('Failed to stop native WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param message The message to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcast(message: string | object, exclude?: WebSocketConnection): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.nativeServer.broadcast(messageStr, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a binary message to all connected clients
   * @param data The binary data to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastBinary(data: Buffer, exclude?: WebSocketConnection): void {
    this.nativeServer.broadcastBinary(data, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a message to all clients in a room
   * @param roomName The room to broadcast to
   * @param message The message to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastToRoom(roomName: string, message: string | object, exclude?: WebSocketConnection): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.nativeServer.broadcastToRoom(roomName, messageStr, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a binary message to all clients in a room
   * @param roomName The room to broadcast to
   * @param data The binary data to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastBinaryToRoom(roomName: string, data: Buffer, exclude?: WebSocketConnection): void {
    this.nativeServer.broadcastBinaryToRoom(roomName, data, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Get all room names
   * @returns Array of room names
   */
  getRooms(): string[] {
    return this.nativeServer.getRooms();
  }

  /**
   * Get the number of clients in a room
   * @param roomName The room name
   * @returns The number of clients in the room
   */
  getRoomSize(roomName: string): number {
    return this.nativeServer.getRoomSize(roomName);
  }

  /**
   * Get all connections in a room
   * @param roomName The room name
   * @returns Array of connections in the room
   */
  getRoomConnections(roomName: string): WebSocketConnection[] {
    const connectionIds = this.nativeServer.getRoomConnections(roomName);
    return connectionIds.map(id => this.connections.get(id)).filter(Boolean) as WebSocketConnection[];
  }

  /**
   * Get the total number of connections
   * @returns The total number of connections
   */
  getConnectionCount(): number {
    return this.nativeServer.getConnectionCount();
  }

  /**
   * Start the heartbeat mechanism
   * @private
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.checkConnections();
    }, this.heartbeatOptions.interval);

    this.logger.debug(`Heartbeat started with interval of ${this.heartbeatOptions.interval}ms`);
  }

  /**
   * Check all connections for activity
   * @private
   */
  private checkConnections(): void {
    const now = Date.now();
    const timeout = this.heartbeatOptions.timeout;

    for (const [id, connection] of this.connections.entries()) {
      // Skip check if connection was recently active
      if (now - connection.lastHeartbeat < this.heartbeatOptions.interval) {
        continue;
      }

      // Check if connection timed out
      if (now - connection.lastHeartbeat > timeout) {
        this.logger.debug(`Connection ${id} timed out, closing`);
        connection.close(1001, 'Connection timeout');
        continue;
      }

      // Send ping to check if connection is alive
      try {
        connection.ping();
      } catch (err) {
        this.logger.debug(`Failed to ping connection ${id}: ${err}`);
      }
    }
  }

  /**
   * Authenticate a WebSocket connection
   * @param connection The connection to authenticate
   * @param token The authentication token
   */
  async authenticateConnection(connection: WebSocketConnection, token: string): Promise<boolean> {
    try {
      // Call the authentication handler
      const user = await this.authOptions.handler(token, connection);

      if (user) {
        connection.isAuthenticated = true;
        connection.user = user;

        // Emit authenticated event
        this.emit('authenticated', { connection, user });

        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return false;
    }
  }

  /**
   * Handle a pong response from a client
   * @param data The data from the native module
   */
  private handlePong(data: any): void {
    const { id } = data;
    const connection = this.connections.get(id);

    if (connection) {
      connection.lastHeartbeat = Date.now();
      connection.isAlive = true;
    }
  }

  /**
   * Handle a new connection
   * @param data The data from the native module
   */
  private handleConnection(data: any): void {
    const { id } = data;
    const now = Date.now();

    // Create connection wrapper
    const connection: WebSocketConnection = {
      id,
      send: (message: string | object) => {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.nativeServer.send(id, messageStr);
      },
      sendBinary: (data: Buffer) => {
        this.nativeServer.sendBinary(id, data);
      },
      close: (code?: number, reason?: string) => {
        this.nativeServer.closeConnection(id, code, reason);
      },
      joinRoom: (roomName: string) => {
        this.nativeServer.joinRoom(id, roomName);
      },
      leaveRoom: (roomName: string) => {
        this.nativeServer.leaveRoom(id, roomName);
      },
      leaveAllRooms: () => {
        this.nativeServer.leaveAllRooms(id);
      },
      isInRoom: (roomName: string) => {
        return this.nativeServer.isInRoom(id, roomName);
      },
      getRooms: () => {
        return this.nativeServer.getConnectionRooms(id);
      },
      isAlive: true,
      isAuthenticated: false,
      data: {},
      lastHeartbeat: now,
      ping: () => {
        this.nativeServer.ping(id);
      }
    };

    // Store connection
    this.connections.set(id, connection);

    // Emit connection event
    this.emit('connection', { connection });

    // Set up authentication timeout if required
    if (this.authOptions.required) {
      const timeout = setTimeout(() => {
        // Check if the connection is still active but not authenticated
        const conn = this.connections.get(id);
        if (conn && !conn.isAuthenticated) {
          this.logger.debug(`Connection ${id} failed to authenticate within timeout, closing`);
          conn.close(1008, 'Authentication timeout');
        }
      }, this.authOptions.timeout);

      // Store timeout reference for cleanup
      connection.data.__authTimeout = timeout;
    }
  }

  /**
   * Handle a message from a client
   * @param data The data from the native module
   */
  private handleMessage(data: any): void {
    const { id, message } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Update heartbeat timestamp
    connection.lastHeartbeat = Date.now();

    try {
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;

      // Handle auth message type if not authenticated
      if (!connection.isAuthenticated && this.authOptions.required && parsedMessage.type === 'auth') {
        this.authenticateConnection(connection, parsedMessage.data.token)
          .then(success => {
            // Clear authentication timeout
            if (connection.data.__authTimeout) {
              clearTimeout(connection.data.__authTimeout);
              delete connection.data.__authTimeout;
            }

            // Send auth response
            connection.send({
              type: 'auth:response',
              data: { success }
            });

            // Close connection if authentication failed
            if (!success) {
              connection.close(1008, 'Authentication failed');
            }
          });

        return;
      }

      // Require authentication if enabled
      if (this.authOptions.required && !connection.isAuthenticated) {
        connection.send({
          type: 'error',
          data: { message: 'Authentication required' }
        });
        return;
      }

      // Emit message event
      this.emit('message', {
        connection,
        message: parsedMessage
      });

      // Emit specific event type if available
      if (parsedMessage.type) {
        this.emit(parsedMessage.type, {
          connection,
          message: parsedMessage
        });
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message:', error);

      // Notify client of error
      connection.send({
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle a binary message from a client
   * @param data The data from the native module
   */
  private handleBinaryMessage(data: any): void {
    const { id, binary } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit binary message event
    this.emit('binary', {
      connection,
      binary: Buffer.from(binary)
    });
  }

  /**
   * Handle a client disconnection
   * @param data The data from the native module
   */
  private handleDisconnect(data: any): void {
    const { id } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit disconnect event
    this.emit('disconnect', { connection });

    // Remove connection
    this.connections.delete(id);
  }

  /**
   * Handle an error
   * @param data The data from the native module
   */
  private handleError(data: any): void {
    const { id, error } = data;
    const connection = this.connections.get(id);

    // Emit error event
    this.emit('error', {
      connection,
      error: new Error(error)
    });
  }

  /**
   * Handle a room join
   * @param data The data from the native module
   */
  private handleRoomJoin(data: any): void {
    const { id, room } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit room join event
    this.emit('room:join', {
      connection,
      room
    });
  }

  /**
   * Handle a room leave
   * @param data The data from the native module
   */
  private handleRoomLeave(data: any): void {
    const { id, room } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit room leave event
    this.emit('room:leave', {
      connection,
      room
    });
  }

  /**
   * Set the authentication handler function for this server
   * @param handler The function to call when authenticating a connection
   */
  setAuthenticationHandler(handler: (token: string, connection: WebSocketConnection) => Promise<any>): void {
    this.authOptions.handler = handler;
  }

  /**
   * Set heartbeat options for this server
   * @param options Heartbeat configuration options
   */
  setHeartbeatOptions(options: Partial<WebSocketHeartbeatOptions>): void {
    this.heartbeatOptions = { ...this.heartbeatOptions, ...options };

    // Restart heartbeat if needed
    if (this.isRunning && this.heartbeatOptions.enabled) {
      this.startHeartbeat();
    }
  }

  /**
   * Set the maximum number of clients per room
   * @param max Maximum number of clients per room (0 = unlimited)
   */
  setMaxClientsPerRoom(max: number): void {
    this.serverOptions.maxClientsPerRoom = max;
  }

  /**
   * Get connection by ID
   * @param id The connection ID
   */
  getConnection(id: number): WebSocketConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get message history for a room
   * @param roomName The room name
   * @returns Array of message strings
   */
  getRoomHistory(roomName: string): string[] {
    return this.nativeServer.getRoomHistory(roomName);
  }

  /**
   * Set maximum size for a room
   * @param roomName The room name
   * @param maxSize Maximum number of clients (0 = unlimited)
   */
  setMaxRoomSize(roomName: string, maxSize: number): void {
    this.nativeServer.setMaxRoomSize(roomName, maxSize);
  }

  /**
   * Set maximum number of connections
   * @param maxConnections Maximum number of connections (0 = unlimited)
   */
  setMaxConnections(maxConnections: number): void {
    this.nativeServer.setMaxConnections(maxConnections);
    this.serverOptions.maxConnections = maxConnections;
  }

  /**
   * Set whether a connection is authenticated
   * @param id The connection ID
   * @param authenticated Whether the connection is authenticated
   */
  setConnectionAuthenticated(id: number, authenticated: boolean): void {
    this.nativeServer.setAuthenticated(id, authenticated);

    const connection = this.connections.get(id);
    if (connection) {
      connection.isAuthenticated = authenticated;
    }
  }

  /**
   * Get connection statistics
   * @returns WebSocket connection statistics
   */
  getConnectionStats(): WebSocketConnectionStats {
    return this.nativeServer.getConnectionStats();
  }

  /**
   * Disconnect inactive connections
   * @param thresholdMs Inactivity threshold in milliseconds
   */
  disconnectInactiveConnections(thresholdMs: number): void {
    this.nativeServer.disconnectInactiveConnections(thresholdMs);
  }

  /**
   * Store a message in a room's history
   * @param roomName The room name
   * @param message The message to store
   * @param maxHistory Maximum history size (0 = unlimited)
   */
  storeRoomMessage(roomName: string, message: string | object, maxHistory: number = 100): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    try {
      // Use direct storage via native module if possible
      if (this.nativeServer.storeRoomMessage) {
        this.nativeServer.storeRoomMessage(roomName, messageStr, maxHistory);
      }
    } catch (error) {
      this.logger.error('Error storing room message:', error);
    }
  }

  /**
   * Get all authenticated connections
   * @returns Array of authenticated connections
   */
  getAuthenticatedConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isAuthenticated);
  }

  /**
   * Get authenticated connections in a room
   * @param roomName The room name
   * @returns Array of authenticated connections in the room
   */
  getAuthenticatedRoomConnections(roomName: string): WebSocketConnection[] {
    return this.getRoomConnections(roomName).filter(conn => conn.isAuthenticated);
  }

  /**
   * Get performance metrics for WebSocket server
   * @returns Performance metrics
   */
  static getPerformanceMetrics(): {
    nativeTime: number;
    nativeCount: number;
  } {
    // Check if the native module has getPerformanceMetrics method
    if (WebSocketServer.nativeModule && typeof WebSocketServer.nativeModule.getPerformanceMetrics === 'function') {
      return {
        nativeTime: WebSocketServer.nativeModule.getPerformanceMetrics().nativeTime,
        nativeCount: WebSocketServer.nativeModule.getPerformanceMetrics().nativeCount
      };
    }

    // Return static metrics if native method is not available
    return {
      nativeTime: WebSocketServer.nativeTime,
      nativeCount: WebSocketServer.nativeCount
    };
  }

  /**
   * Reset performance metrics for WebSocket server
   */
  static resetPerformanceMetrics(): void {
    // Check if the native module has resetPerformanceMetrics method
    if (WebSocketServer.nativeModule && typeof WebSocketServer.nativeModule.resetPerformanceMetrics === 'function') {
      WebSocketServer.nativeModule.resetPerformanceMetrics();
    } else {
      // Reset static metrics if native method is not available
      WebSocketServer.nativeTime = 0;
      WebSocketServer.nativeCount = 0;
    }
  }
}
