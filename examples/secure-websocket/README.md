# Secure WebSocket Chat Example

This example demonstrates an enhanced WebSocket implementation with the following features:

- **Authentication** - Secure WebSocket connections with token-based authentication
- **Heartbeat Mechanism** - Automatic connection monitoring to detect and close stale connections
- **Room Management** - Create, join, and leave chat rooms with user presence notifications
- **Message History** - Store and replay message history for each room
- **Structured Events** - Typed event system with specialized event handlers

## Features

- **Secure Authentication**: Only authenticated users can send and receive messages
- **Connection Monitoring**: Automatically detect and close inactive connections
- **Room-based Messaging**: Organize communications into separate rooms
- **Message History**: New users receive previous messages when joining a room
- **Presence Notifications**: Room notifications when users join or leave
- **Rich Client Interface**: Complete browser-based chat client

## Running the Example

1. Start the server:

   ```bash
   npx ts-node examples/secure-websocket/index.ts
   ```

2. Open `examples/secure-websocket/client.html` in your browser

3. Use one of the test tokens to authenticate:
   - User: `user-token-123`
   - Admin: `admin-token-456`

4. Connect and start chatting in available rooms!

## Technical Implementation

This example demonstrates several advanced WebSocket features:

### Server-Side Features

- **Authentication Middleware**: Token verification before allowing WebSocket communication
- **Heartbeat Protocol**: Automatic ping/pong to detect stale connections
- **Controller-based Architecture**: Clean separation of WebSocket event handlers
- **Room Management**: Efficient tracking of users in different chat rooms
- **Connection Metadata**: Store user data with each connection

### Client-Side Features

- **Authentication Flow**: Secure login process with token-based auth
- **Heartbeat Management**: Client-side ping to keep connections alive
- **Room Navigation**: Join and leave different chat rooms
- **Message Rendering**: Display different message types with appropriate styling
- **Connection Status**: Clear indication of connection and authentication status

## Code Structure

- `index.ts` - Main server setup and configuration
- `chat-controller.ts` - WebSocket controller with event handlers
- `client.html` - Browser-based client interface

## Security Considerations

This example implements several security best practices:

1. **Required Authentication**: All WebSocket connections must authenticate
2. **Authentication Timeout**: Connections must authenticate within a configurable timeout
3. **Connection Limits**: Configurable limits for total connections and users per room
4. **Heartbeat Verification**: Stale connections are automatically closed
5. **Message Validation**: Properly structured messages are required
