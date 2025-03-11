# NexureJS Framework Guide

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Core Components](#core-components)
  - [Routing](#routing)
  - [Middleware](#middleware)
  - [Dependency Injection](#dependency-injection)
  - [WebSockets](#websockets)
  - [Authentication](#authentication)
- [Advanced Usage](#advanced-usage)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Introduction

NexureJS is a high-performance, modular Node.js framework designed with modern developer experience in mind. It combines the best aspects of popular frameworks with native performance optimizations.

### Key Features

- **High Performance**: Native C++ modules for performance-critical operations
- **Modern TypeScript Support**: First-class TypeScript support
- **Decorator-Based API**: Intuitive, decorator-based syntax
- **Dependency Injection**: Powerful DI system
- **WebSocket Support**: Built-in WebSocket capabilities
- **Middleware System**: Flexible middleware architecture
- **Modular Design**: Use only what you need

## Getting Started

### Installation

```bash
npm install nexurejs
```

### Basic Application

```typescript
import { Nexure } from 'nexurejs';
import { Controller, Get } from 'nexurejs/decorators';

@Controller('/hello')
class HelloController {
  @Get()
  sayHello() {
    return { message: 'Hello, NexureJS!' };
  }
}

const app = new Nexure();
app.register(HelloController);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Project Structure

A typical NexureJS project structure looks like this:

```
my-nexure-app/
├── src/
│   ├── controllers/
│   │   ├── user.controller.ts
│   │   └── auth.controller.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   └── auth.service.ts
│   ├── models/
│   │   └── user.model.ts
│   ├── middleware/
│   │   ├── logger.middleware.ts
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   └── helpers.ts
│   └── app.ts
├── tests/
├── package.json
└── tsconfig.json
```

## Core Components

### Routing

NexureJS provides a flexible routing system with support for route parameters, query parameters, and different HTTP methods.

#### Basic Routing

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body } from 'nexurejs/decorators';

@Controller('/users')
class UserController {
  @Get()
  getAllUsers() {
    // Handle GET /users
    return [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }];
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    // Handle GET /users/:id
    return { id, name: `User ${id}` };
  }

  @Post()
  createUser(@Body() userData: any) {
    // Handle POST /users
    return { id: 3, ...userData };
  }

  @Put('/:id')
  updateUser(@Param('id') id: string, @Body() userData: any) {
    // Handle PUT /users/:id
    return { id, ...userData };
  }

  @Delete('/:id')
  deleteUser(@Param('id') id: string) {
    // Handle DELETE /users/:id
    return { message: `User ${id} deleted` };
  }
}
```

#### Route Parameters

Route parameters can be accessed using the `@Param` decorator:

```typescript
@Get('/:id')
getUserById(@Param('id') id: string) {
  return { id, name: `User ${id}` };
}
```

#### Query Parameters

Query parameters can be accessed using the `@Query` decorator:

```typescript
@Get()
searchUsers(@Query('name') name: string, @Query('role') role: string) {
  return { name, role };
}
```

#### Request Body

Request body can be accessed using the `@Body` decorator:

```typescript
@Post()
createUser(@Body() userData: any) {
  return { id: 3, ...userData };
}
```

#### Headers

Headers can be accessed using the `@Header` decorator:

```typescript
@Get()
getWithAuth(@Header('authorization') auth: string) {
  return { auth };
}
```

### Middleware

Middleware functions are functions that have access to the request object, the response object, and the next middleware function in the application's request-response cycle.

#### Creating Middleware

```typescript
import { Middleware, MiddlewareHandler } from 'nexurejs/middleware';

@Middleware()
class LoggerMiddleware implements MiddlewareHandler {
  async handle(req: any, res: any, next: () => Promise<void>): Promise<void> {
    console.log(`${req.method} ${req.url}`);
    await next();
    console.log(`Response status: ${res.statusCode}`);
  }
}
```

#### Using Middleware

```typescript
import { Nexure } from 'nexurejs';
import { LoggerMiddleware } from './middleware/logger.middleware';

const app = new Nexure();
app.use(new LoggerMiddleware());
```

#### Global Middleware

Middleware can be applied globally:

```typescript
// Apply middleware to all routes
app.use(new LoggerMiddleware());
```

#### Controller-Specific Middleware

Middleware can be applied to specific controllers:

```typescript
@Controller('/users')
@UseMiddleware(AuthMiddleware)
class UserController {
  // Controller methods
}
```

#### Route-Specific Middleware

Middleware can be applied to specific routes:

```typescript
@Post()
@UseMiddleware(ValidationMiddleware)
createUser(@Body() userData: any) {
  return { id: 3, ...userData };
}
```

### Dependency Injection

NexureJS includes a powerful dependency injection system that helps manage dependencies between different parts of your application.

#### Injectable Services

```typescript
import { Injectable } from 'nexurejs/decorators';

@Injectable()
class UserService {
  getUsers() {
    return [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }];
  }

  getUserById(id: string) {
    return { id, name: `User ${id}` };
  }
}
```

#### Using Services in Controllers

```typescript
import { Controller, Get, Param } from 'nexurejs/decorators';
import { UserService } from './services/user.service';

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getUsers();
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }
}
```

#### Service Scopes

Services can have different scopes:

```typescript
import { Injectable, ServiceScope } from 'nexurejs/decorators';

@Injectable({ scope: ServiceScope.SINGLETON })
class ConfigService {
  // Singleton: One instance for the entire application
}

@Injectable({ scope: ServiceScope.REQUEST })
class RequestService {
  // Request-scoped: New instance for each request
}

@Injectable({ scope: ServiceScope.TRANSIENT })
class TransientService {
  // Transient: New instance each time it's injected
}
```

### WebSockets

NexureJS provides built-in WebSocket support with both native (C++) and JavaScript implementations.

#### Basic WebSocket Setup

```typescript
import { Nexure } from 'nexurejs';

const app = new Nexure({
  websocket: {
    enabled: true  // Default is true
  }
});
```

#### Creating a WebSocket Controller

```typescript
import {
  WebSocketController,
  OnConnect,
  OnMessage,
  OnJoinRoom,
  OnLeaveRoom,
  WebSocketContext
} from 'nexurejs/decorators';

@WebSocketController()
class ChatController {
  @OnConnect()
  handleConnection(context: WebSocketContext) {
    console.log('New connection');

    // Send welcome message
    context.connection.send({
      type: 'welcome',
      data: { message: 'Welcome to the chat!' }
    });
  }

  @OnMessage()
  handleMessage(context: WebSocketContext) {
    console.log('Received message:', context.message);

    // Echo the message back
    context.connection.send({
      type: 'echo',
      data: context.message?.data
    });
  }

  @OnJoinRoom()
  handleJoinRoom(context: WebSocketContext) {
    const { room } = context;
    console.log(`User joined room: ${room}`);
  }

  @OnLeaveRoom()
  handleLeaveRoom(context: WebSocketContext) {
    const { room } = context;
    console.log(`User left room: ${room}`);
  }
}

// Register the controller
app.register(ChatController);
```

#### Client-Side WebSocket Usage

```javascript
// Connect to the WebSocket server
const socket = new WebSocket('ws://localhost:3000');

// Handle connection open
socket.onopen = () => {
  console.log('Connected to server');

  // Join a room
  socket.send(JSON.stringify({
    type: 'join',
    room: 'general'
  }));

  // Send a message
  socket.send(JSON.stringify({
    type: 'message',
    data: { text: 'Hello, everyone!' },
    room: 'general'
  }));
};

// Handle incoming messages
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Handle disconnection
socket.onclose = () => {
  console.log('Disconnected from server');
};
```

### Authentication

NexureJS can be easily integrated with various authentication strategies, including JWT.

#### JWT Authentication Middleware

```typescript
import { Middleware, MiddlewareHandler } from 'nexurejs/middleware';
import jwt from 'jsonwebtoken';

@Middleware()
export class JwtAuthMiddleware implements MiddlewareHandler {
  async handle(req: any, res: any, next: () => Promise<void>): Promise<void> {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        res.status(401).send({ message: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;

      await next();
    } catch (error) {
      res.status(401).send({ message: 'Invalid token' });
    }
  }
}
```

#### Authentication Controller

```typescript
import { Controller, Post, Body } from 'nexurejs/decorators';
import jwt from 'jsonwebtoken';

@Controller('/auth')
class AuthController {
  @Post('/login')
  login(@Body() credentials: { username: string; password: string }) {
    // In a real app, validate credentials against a database
    if (credentials.username === 'admin' && credentials.password === 'password') {
      const token = jwt.sign(
        { userId: 1, username: credentials.username },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );

      return { token };
    }

    return { message: 'Invalid credentials' };
  }
}
```

#### Protected Routes

```typescript
import { Controller, Get, UseMiddleware } from 'nexurejs/decorators';
import { JwtAuthMiddleware } from './middleware/jwt-auth.middleware';

@Controller('/profile')
@UseMiddleware(JwtAuthMiddleware)
class ProfileController {
  @Get()
  getProfile(req: any) {
    // req.user contains the decoded JWT payload
    return { profile: req.user };
  }
}
```

## Advanced Usage

### Error Handling

NexureJS provides a built-in error handling system:

```typescript
import { Nexure } from 'nexurejs';
import { Controller, Get } from 'nexurejs/decorators';

@Controller('/error')
class ErrorController {
  @Get('/test')
  testError() {
    throw new Error('Test error');
  }
}

const app = new Nexure();
app.register(ErrorController);

// Custom error handler
app.setErrorHandler((error, req, res) => {
  console.error('Error:', error.message);
  res.status(500).send({ error: error.message });
});
```

### Custom Decorators

You can create custom decorators for common patterns:

```typescript
import { createParamDecorator } from 'nexurejs/decorators';

// Create a custom decorator for extracting the user from the request
export const CurrentUser = createParamDecorator((req) => req.user);

// Using the custom decorator
@Get('/me')
getProfile(@CurrentUser() user: any) {
  return { profile: user };
}
```

### Configuration Management

Managing configuration in different environments:

```typescript
import { Nexure } from 'nexurejs';
import { Config } from 'nexurejs/utils';

// Load configuration
const config = new Config();
config.load({
  development: {
    port: 3000,
    database: {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres'
    }
  },
  production: {
    port: process.env.PORT || 8080,
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  }
});

// Use configuration
const app = new Nexure();
app.listen(config.get('port'), () => {
  console.log(`Server running on port ${config.get('port')}`);
});
```

## Common Patterns

### Controller-Service-Repository Pattern

```typescript
// Repository
@Injectable()
class UserRepository {
  private users = [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }];

  findAll() {
    return this.users;
  }

  findById(id: number) {
    return this.users.find(user => user.id === id);
  }
}

// Service
@Injectable()
class UserService {
  constructor(private userRepository: UserRepository) {}

  getUsers() {
    return this.userRepository.findAll();
  }

  getUserById(id: number) {
    return this.userRepository.findById(id);
  }
}

// Controller
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getUsers();
  }

  @Get('/:id')
  getUserById(@Param('id') id: number) {
    return this.userService.getUserById(id);
  }
}
```

### Request Validation

```typescript
import { Controller, Post, Body } from 'nexurejs/decorators';
import { ValidateSchema } from 'nexurejs/middleware';

// Define a validation schema
const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 3 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 18 }
  },
  required: ['name', 'email', 'age']
};

@Controller('/users')
class UserController {
  @Post()
  @ValidateSchema(userSchema)
  createUser(@Body() userData: any) {
    // userData is guaranteed to be valid
    return { id: 3, ...userData };
  }
}
```

## Troubleshooting

### Common Errors

#### Controller Not Registered

If your routes aren't working, make sure you've registered your controllers with the app:

```typescript
app.register(UserController);
```

#### Dependency Injection Errors

If you're having issues with dependency injection, check that:

1. All services are decorated with `@Injectable()`
2. Services are registered before they're used
3. Circular dependencies are resolved using `forwardRef()`

#### WebSocket Connection Issues

If WebSocket connections aren't working:

1. Ensure WebSockets are enabled in the app configuration
2. Check that WebSocket controllers are registered
3. Verify the client is connecting to the correct URL
4. Check for CORS issues if connecting from a different domain

### Debugging

To enable debug logging:

```typescript
const app = new Nexure({
  logging: true
});
```

For more detailed logs, set the NODE_DEBUG environment variable:

```bash
NODE_DEBUG=nexure:* node app.js
```
