import { Nexure } from '../../src/core/nexure.js';
import { SecureChatController } from './chat-controller.js';

// Create Nexure instance with WebSocket configuration
const app = new Nexure({
  logging: true,

  // Configure WebSockets with authentication and heartbeat
  websocket: {
    enabled: true,
    config: {
      // Authentication configuration
      auth: {
        required: true,
        timeout: 10000  // 10 seconds to authenticate
      },

      // Heartbeat configuration
      heartbeat: {
        enabled: true,
        interval: 30000,  // Check every 30 seconds
        timeout: 10000    // 10 seconds to respond
      },

      // Connection limits
      maxConnections: 1000,
      maxClientsPerRoom: 100
    }
  }
});

// Register the chat controller
app.register(SecureChatController);

// Make app instance available globally for easy access from controller
(global as any).nexure = app;

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Secure WebSocket chat server started on port ${PORT}`);
  console.log(`Available rooms: general, support, random`);
  console.log(`Test users:`);
  console.log(`  - User:  token=user-token-123`);
  console.log(`  - Admin: token=admin-token-456`);
});
