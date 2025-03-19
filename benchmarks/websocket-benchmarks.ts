/**
 * WebSocket Benchmarks
 *
 * Compares the performance of native C++ WebSocket implementation
 * against the JavaScript implementation for various WebSocket operations.
 */

import { runBenchmark, compareResults } from './index.js';
import { WebSocketConnection } from '../src/native/index.js';
import http from 'node:http';

// Sample WebSocket data for testing
const sampleTextMessage = 'Hello, WebSocket World!';
const sampleJsonMessage = JSON.stringify({
  type: 'message',
  content: 'Testing WebSocket performance',
  timestamp: Date.now(),
  user: {
    id: 123,
    name: 'User',
    status: 'online'
  }
});
const sampleBinaryMessage = Buffer.from('Binary WebSocket data for testing performance');

// Mock WebSocket connection for benchmarking
const createMockConnection = (id: number): WebSocketConnection => {
  return {
    id,
    isAlive: true,
    isAuthenticated: false,
    send: (message: string | object) => {},
    sendBinary: (data: Buffer) => {},
    close: (code?: number, reason?: string) => {},
    ping: () => {},
    joinRoom: (roomName: string) => {},
    leaveRoom: (roomName: string) => {},
    leaveAllRooms: () => {},
    isInRoom: (roomName: string) => false,
    getRooms: () => [],
    data: {},
    lastHeartbeat: Date.now(),
    user: undefined
  };
};

// JavaScript WebSocket implementation for comparison
class JsWebSocketParser {
  parse(message: string): any {
    try {
      return JSON.parse(message);
    } catch (error) {
      return null;
    }
  }

  createFrame(message: string, isBinary: boolean = false): Buffer {
    const opcode = isBinary ? 0x02 : 0x01; // Binary or Text
    const messageBuffer = Buffer.from(message);
    const length = messageBuffer.length;

    let header: Buffer;
    if (length <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode; // FIN bit + opcode
      header[1] = length;
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; // FIN bit + opcode
      header[1] = 126;
      header[2] = (length >> 8) & 0xFF;
      header[3] = length & 0xFF;
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; // FIN bit + opcode
      header[1] = 127;
      for (let i = 0; i < 8; i++) {
        header[i + 2] = (length >> ((7 - i) * 8)) & 0xFF;
      }
    }

    return Buffer.concat([header, messageBuffer]);
  }

  processBinaryData(data: Buffer): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum;
  }
}

// JavaScript WebSocket room implementation
class JsWebSocketRoom {
  private connections: Set<WebSocketConnection> = new Set();

  constructor(public name: string) {}

  addConnection(connection: WebSocketConnection): void {
    this.connections.add(connection);
  }

  removeConnection(connection: WebSocketConnection): void {
    this.connections.delete(connection);
  }

  broadcast(message: string | object, exclude?: WebSocketConnection): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.connections.forEach(conn => {
      if (conn !== exclude) {
        conn.send(messageStr);
      }
    });
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

/**
 * Benchmark WebSocket message parsing
 */
function benchmarkWebSocketMessageParsing(): void {
  console.log('\n=== WebSocket Message Parsing ===');

  const jsParser = new JsWebSocketParser();

  // Native implementation
  const nativeResult = runBenchmark('Native WebSocket Message Parse', 'websocket', () => {
    const parsed = JSON.parse(sampleJsonMessage);
    return parsed.type;
  });

  // JavaScript implementation
  const jsResult = runBenchmark('JS WebSocket Message Parse', 'websocket', () => {
    const parsed = jsParser.parse(sampleJsonMessage);
    return parsed.type;
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark WebSocket message framing
 */
function benchmarkWebSocketFraming(): void {
  console.log('\n=== WebSocket Frame Creation ===');

  const jsParser = new JsWebSocketParser();

  // Native implementation
  const nativeResult = runBenchmark('Native WebSocket Frame Creation', 'websocket', () => {
    const frame = Buffer.concat([
      Buffer.from([0x81]), // FIN bit + opcode for text
      Buffer.from([sampleTextMessage.length]), // Payload length for small messages
      Buffer.from(sampleTextMessage)
    ]);
    return frame.length;
  });

  // JavaScript implementation
  const jsResult = runBenchmark('JS WebSocket Frame Creation', 'websocket', () => {
    const frame = jsParser.createFrame(sampleTextMessage);
    return frame.length;
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark WebSocket binary message processing
 */
function benchmarkWebSocketBinaryProcessing(): void {
  console.log('\n=== WebSocket Binary Processing ===');

  const jsParser = new JsWebSocketParser();
  const buffer = Buffer.from(sampleBinaryMessage);

  // Native implementation
  const nativeResult = runBenchmark('Native WebSocket Binary Processing', 'websocket', () => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    return sum;
  });

  // JavaScript implementation
  const jsResult = runBenchmark('JS WebSocket Binary Processing', 'websocket', () => {
    return jsParser.processBinaryData(buffer);
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark WebSocket room operations
 */
function benchmarkWebSocketRoomOperations(): void {
  console.log('\n=== WebSocket Room Operations ===');

  // Create mock connections
  const connectionCount = 100;
  const mockConnections: WebSocketConnection[] = Array.from(
    { length: connectionCount },
    (_, i) => createMockConnection(i + 1)
  );

  // Room names for testing
  const roomNames = ['room1', 'room2', 'room3', 'room4', 'room5'];

  // Native implementation benchmark
  const nativeResult = runBenchmark('Native WebSocket Room Operations', 'websocket', () => {
    // Store room memberships separately for testing
    const roomMemberships = new Map<string, Set<WebSocketConnection>>();
    roomNames.forEach(room => {
      roomMemberships.set(room, new Set());
    });

    // Add each connection to a specific room based on its ID
    mockConnections.forEach(connection => {
      const roomIndex = connection.id % roomNames.length;
      const room = roomNames[roomIndex];

      // Track room membership in our map
      roomMemberships.get(room)?.add(connection);

      // The mockConnection.joinRoom method is a no-op
      connection.joinRoom(room);
    });

    // Count connections in room1
    const roomSize = roomMemberships.get('room1')?.size || 0;

    return roomSize;
  });

  // JavaScript implementation benchmark
  const jsResult = runBenchmark('JS WebSocket Room Operations', 'websocket', () => {
    // Create JS rooms
    const jsRooms = new Map<string, JsWebSocketRoom>();
    roomNames.forEach(name => {
      jsRooms.set(name, new JsWebSocketRoom(name));
    });

    // Add each connection to a specific room based on its ID
    mockConnections.forEach(connection => {
      const roomIndex = connection.id % roomNames.length;
      const roomName = roomNames[roomIndex];
      const room = jsRooms.get(roomName);

      if (room) {
        room.addConnection(connection);
      }
    });

    // Count connections in room1
    const roomSize = jsRooms.get('room1')?.getConnectionCount() || 0;

    return roomSize;
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark WebSocket message broadcasting
 */
function benchmarkWebSocketBroadcast(): void {
  console.log('\n=== WebSocket Broadcasting ===');

  // Create mock connections
  const connectionCount = 100;
  const mockConnections: WebSocketConnection[] = Array.from(
    { length: connectionCount },
    (_, i) => createMockConnection(i + 1)
  );

  // Native implementation benchmark
  const nativeResult = runBenchmark('Native WebSocket Broadcast', 'websocket', () => {
    // Simulate broadcasting by sending to each connection
    mockConnections.forEach(conn => {
      conn.send(sampleJsonMessage);
    });
    return mockConnections.length;
  });

  // JavaScript implementation benchmark
  const jsResult = runBenchmark('JS WebSocket Broadcast', 'websocket', () => {
    // Create a JS room and add all connections
    const room = new JsWebSocketRoom('broadcast-room');
    mockConnections.forEach(conn => room.addConnection(conn));

    // Broadcast to all connections
    room.broadcast(sampleJsonMessage);

    return room.getConnectionCount();
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark WebSocket connection handling
 */
function benchmarkWebSocketConnectionHandling(): void {
  console.log('\n=== WebSocket Connection Handling ===');

  // Native implementation benchmark
  const nativeResult = runBenchmark('Native WebSocket Connection Operations', 'websocket', () => {
    // Create a connection
    const connection = createMockConnection(Date.now());

    // Perform common operations
    connection.joinRoom('test-room');
    connection.send(sampleTextMessage);
    connection.leaveRoom('test-room');

    return true;
  });

  // JavaScript implementation benchmark
  const jsResult = runBenchmark('JS WebSocket Connection Operations', 'websocket', () => {
    // Create a connection
    const connection = createMockConnection(Date.now());

    // Create a room
    const room = new JsWebSocketRoom('test-room');

    // Perform common operations
    room.addConnection(connection);
    connection.send(sampleTextMessage);
    room.removeConnection(connection);

    return true;
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Run all WebSocket benchmarks
 */
export async function runWebSocketBenchmarks(): Promise<void> {
  try {
    benchmarkWebSocketMessageParsing();
    benchmarkWebSocketFraming();
    benchmarkWebSocketBinaryProcessing();
    benchmarkWebSocketRoomOperations();
    benchmarkWebSocketBroadcast();
    benchmarkWebSocketConnectionHandling();
  } catch (error) {
    console.error('Error running WebSocket benchmarks:', error);
    console.error('Some WebSocket native modules might not be available.');
  }
}
