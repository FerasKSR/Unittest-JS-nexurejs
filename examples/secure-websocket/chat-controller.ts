import {
  WebSocketController,
  WebSocketAuthHandler,
  OnAuthenticated,
  OnConnect,
  OnDisconnect,
  OnMessage,
  OnJoinRoom,
  OnLeaveRoom,
  WebSocketContext,
  WebSocketAuthContext
} from '../../src/decorators/websocket-decorators.js';

interface ChatMessage {
  type: string;
  text: string;
  room?: string;
  user?: string;
  timestamp: number;
}

interface ChatUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Secure chat room controller with authentication
 */
@WebSocketController()
export class SecureChatController {
  // Store of authenticated users
  private users: Map<string, ChatUser> = new Map();

  // Message history for each room
  private roomHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    // Initialize with some demo users (in a real app, this would come from a database)
    this.users.set('user-token-123', { id: 'user1', username: 'john', role: 'user' });
    this.users.set('admin-token-456', { id: 'admin1', username: 'admin', role: 'admin' });

    // Initialize some room history
    this.roomHistory.set('general', [
      {
        type: 'message',
        text: 'Welcome to the general chat room!',
        user: 'system',
        room: 'general',
        timestamp: Date.now() - 3600000
      }
    ]);
  }

  /**
   * Authenticate a WebSocket connection
   */
  @WebSocketAuthHandler()
  async authenticate({ token, connection }: WebSocketAuthContext): Promise<ChatUser | null> {
    // Validate the token (in a real app, this would verify a JWT or session)
    const user = this.users.get(token);

    if (user) {
      console.log(`User authenticated: ${user.username} (${user.role})`);

      // Store user data on the connection for later use
      connection.data.userId = user.id;
      connection.data.username = user.username;
      connection.data.role = user.role;

      return user;
    }

    console.log(`Authentication failed for token: ${token}`);
    return null;
  }

  /**
   * Handle new connection
   */
  @OnConnect()
  handleConnection(context: WebSocketContext): void {
    console.log(`New connection established`);

    // Send welcome message
    context.connection.send({
      type: 'system',
      data: { message: 'Welcome to the secure chat server. Please authenticate.' }
    });
  }

  /**
   * Handle successful authentication
   */
  @OnAuthenticated()
  handleAuthenticated(context: WebSocketContext): void {
    const { connection, user } = context;

    console.log(`User authenticated: ${user.username}`);

    // Send welcome message
    connection.send({
      type: 'system',
      data: {
        message: `Welcome, ${user.username}! You are now authenticated.`,
        rooms: Array.from(this.roomHistory.keys())
      }
    });
  }

  /**
   * Handle disconnect
   */
  @OnDisconnect()
  handleDisconnect(context: WebSocketContext): void {
    const { connection } = context;
    const username = connection.data.username || 'Unknown user';

    console.log(`User disconnected: ${username}`);

    // Notify rooms that user has left
    for (const room of connection.getRooms()) {
      this.notifyRoom(room, {
        type: 'user:left',
        text: `${username} has left the room`,
        room,
        user: 'system',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle messages
   */
  @OnMessage()
  handleMessage(context: WebSocketContext): void {
    const { connection, message } = context;

    // Skip if no message
    if (!message) return;

    // Get user info from connection
    const username = connection.data.username;
    const userId = connection.data.userId;

    console.log(`Message from ${username}: ${JSON.stringify(message)}`);

    // Handle different message types
    switch (message.type) {
      case 'chat':
        this.handleChatMessage(connection, {
          type: 'message',
          text: message.data.text,
          room: message.data.room,
          user: username,
          timestamp: Date.now()
        });
        break;

      case 'join:room':
        if (message.data.room) {
          connection.joinRoom(message.data.room);
        }
        break;

      case 'leave:room':
        if (message.data.room) {
          connection.leaveRoom(message.data.room);
        }
        break;

      case 'get:history':
        if (message.data.room) {
          this.sendRoomHistory(connection, message.data.room);
        }
        break;

      default:
        // Unknown message type
        connection.send({
          type: 'error',
          data: { message: 'Unknown message type' }
        });
    }
  }

  /**
   * Handle room join
   */
  @OnJoinRoom()
  handleJoinRoom(context: WebSocketContext): void {
    const { connection, room } = context;

    if (!room) return;

    const username = connection.data.username;

    console.log(`${username} joined room: ${room}`);

    // Create room if it doesn't exist
    if (!this.roomHistory.has(room)) {
      this.roomHistory.set(room, []);
    }

    // Send room history
    this.sendRoomHistory(connection, room);

    // Notify room about new user
    this.notifyRoom(room, {
      type: 'user:joined',
      text: `${username} has joined the room`,
      room,
      user: 'system',
      timestamp: Date.now()
    });
  }

  /**
   * Handle room leave
   */
  @OnLeaveRoom()
  handleLeaveRoom(context: WebSocketContext): void {
    const { connection, room } = context;

    if (!room) return;

    const username = connection.data.username;

    console.log(`${username} left room: ${room}`);

    // Notify room about user leaving
    this.notifyRoom(room, {
      type: 'user:left',
      text: `${username} has left the room`,
      room,
      user: 'system',
      timestamp: Date.now()
    });
  }

  /**
   * Handle chat messages
   */
  private handleChatMessage(connection: WebSocketContext['connection'], message: ChatMessage): void {
    const { room } = message;

    if (!room) {
      // Direct message to user not in a room
      connection.send({
        type: 'error',
        data: { message: 'Please join a room first' }
      });
      return;
    }

    // Store message in room history (limit to 100 messages per room)
    const history = this.roomHistory.get(room) || [];
    history.push(message);

    // Trim history if it gets too long
    if (history.length > 100) {
      history.shift();
    }

    this.roomHistory.set(room, history);

    // Broadcast to room
    this.notifyRoom(room, message);
  }

  /**
   * Send room message history to a client
   */
  private sendRoomHistory(connection: WebSocketContext['connection'], room: string): void {
    const history = this.roomHistory.get(room) || [];

    connection.send({
      type: 'history',
      data: {
        room,
        messages: history
      }
    });
  }

  /**
   * Notify all clients in a room
   */
  private notifyRoom(room: string, message: ChatMessage): void {
    const server = (global as any).nexure?.getWebSocketServer();

    if (!server) return;

    server.broadcastToRoom(room, {
      type: 'chat',
      data: message
    });
  }
}
