# NexureJS Examples Guide

This document provides an overview of all the examples included in the NexureJS framework, demonstrating how to use its features in real-world scenarios.

## Example Categories

The examples are organized into the following categories:

- **Basics**: Simple examples for getting started
- **API Development**: Examples showing how to build RESTful APIs
- **Performance**: Demonstrations of performance optimizations
- **Security**: Security best practices and implementations
- **Advanced Features**: Examples showcasing more complex features
- **Real-world Use Cases**: Complete application examples

## Running the Examples

Unless otherwise specified in the example's own README, you can run any example using:

```bash
# From the root directory of the project:
node examples/[path-to-example]/[example-file].js
```

For TypeScript examples:

```bash
# First compile the TypeScript code
npm run build

# Then run the compiled JavaScript
node dist/examples/[path-to-example]/[example-file].js
```

## Basic Examples

### Simple Server (`basic/simple-server.js`)

A minimal HTTP server with basic routing, demonstrating:

- Setting up a Nexure application
- Defining routes with path parameters
- Request body parsing (JSON)
- Response formatting with proper status codes
- Error handling
- Using middleware for request logging

**Key concepts:**
- Creating a Nexure application instance
- Defining routes with different HTTP methods
- Using middleware functions
- Handling parameters in routes
- Sending JSON responses

**Running the example:**
```bash
node examples/basic/simple-server.js
```

### Middleware Basics (`basic/middleware-basics.js`)

A comprehensive demonstration of middleware usage patterns, including:

- Global middleware application
- Route-specific middleware
- Middleware chaining
- Error-handling middleware
- Conditional middleware execution

**Key concepts:**
- Creating reusable middleware functions
- Applying middleware globally
- Applying middleware to specific routes
- Creating authentication middleware
- Handling errors with middleware

**Running the example:**
```bash
node examples/basic/middleware-basics.js
```

## API Development Examples

### Input Validation (`api/input-validation.js`)

A comprehensive example of implementing validation for API endpoints:

- Schema-based validation
- Custom validation rules for different data types
- Detailed error messages
- Reusable validation middleware

**Key concepts:**
- Creating validation schemas
- Implementing a validation middleware factory
- Custom validation functions
- Providing detailed validation error messages
- Integrating validation with route handlers

**Running the example:**
```bash
node examples/api/input-validation.js
```

## Performance Examples

### Streaming (`performance/streaming.js`)

An example demonstrating efficient handling of large data with streams:

- File uploads with streaming
- Large file downloads with compression
- Real-time data transformations
- Memory-efficient data generation

**Key concepts:**
- Creating custom transform streams
- Handling file uploads with streams
- Streaming file downloads
- Implementing compression
- Generating large datasets efficiently

**Running the example:**
```bash
node examples/performance/streaming.js
```

### Adaptive Buffers (`performance/adaptive-buffers.js`)

Demonstrates how to work with adaptive buffers for optimal performance:

- Dynamic buffer sizing based on workload
- Buffer pooling for memory efficiency
- Performance monitoring
- Adaptive strategy implementation

**Key concepts:**
- Creating and using buffer pools
- Implementing adaptive buffer sizing
- Monitoring memory usage
- Performance comparison with standard buffers

**Running the example:**
```bash
node examples/performance/adaptive-buffers.js
```

### Worker Pools (`performance/worker-pools.js`)

Shows how to leverage worker threads for CPU-intensive tasks:

- Creating adaptive worker pools
- Distributing tasks across workers
- Dynamic scaling based on workload
- Handling worker failures

**Key concepts:**
- Creating worker threads
- Managing a worker pool
- Sending tasks to workers
- Handling worker responses
- Implementing adaptive scaling

**Running the example:**
```bash
node examples/performance/worker-pools.js
```

## Security Examples

### JWT Authentication (`security/jwt-auth.js`)

Demonstrates implementing JWT-based authentication:

- Token generation and validation
- Protected routes
- Role-based authorization
- Token refresh mechanism
- Secure password handling

**Key concepts:**
- JWT token generation
- Token validation middleware
- Protecting routes with authentication
- Implementing role-based access control
- Handling token expiration

**Running the example:**
```bash
node examples/security/jwt-auth.js
```

### Rate Limiting (`security/rate-limiting.js`)

Shows how to implement rate limiting to protect your API:

- Request rate tracking
- Different rate limit strategies
- Custom headers for rate limit information
- Configurable limits by route or user

**Key concepts:**
- Implementing a rate limiting middleware
- Configuring limits based on routes
- Setting rate limit headers
- Handling rate limit exceeded errors

**Running the example:**
```bash
node examples/security/rate-limiting.js
```

## Advanced Features

### WebSockets (`advanced/websockets.js`)

Demonstrates real-time communication with WebSockets:

- Setting up a WebSocket server
- Handling connections and messages
- Broadcasting to all clients
- Implementing rooms for group communication
- Integrating with the REST API

**Key concepts:**
- Setting up a WebSocket server
- Handling WebSocket connections
- Sending and receiving messages
- Implementing chat rooms
- Managing client connections

**Running the example:**
```bash
node examples/advanced/websockets.js
```

### Dependency Injection (`advanced/dependency-injection.js`)

Shows how to use the dependency injection system:

- Creating injectable services
- Service registration and resolution
- Scoped services (singleton, request, transient)
- Using decorators for dependency injection

**Key concepts:**
- Creating injectable services
- Registering services with the container
- Using dependency injection in controllers
- Managing service lifecycles

**Running the example:**
```bash
node examples/advanced/dependency-injection.js
```

## Real-world Use Cases

### Todo API (`real-world/todo-api/`)

A complete Todo list API with authentication, demonstrating:

- User registration and authentication
- CRUD operations for todos
- Data validation
- Error handling
- Testing

**Key concepts:**
- Building a complete RESTful API
- Implementing authentication
- Handling relationships between resources
- Input validation
- Comprehensive error handling

**Running the example:**
```bash
cd examples/real-world/todo-api
npm install
npm start
```

### File Upload Service (`real-world/file-upload/`)

A service for handling file uploads with progress tracking:

- Multipart form handling
- File storage and retrieval
- Upload progress tracking
- File metadata handling
- Security considerations

**Key concepts:**
- Handling multipart form data
- Streaming file uploads
- Tracking upload progress
- Securely storing files
- Serving files with proper headers

**Running the example:**
```bash
cd examples/real-world/file-upload
npm install
npm start
```

## Contribution

Feel free to contribute your own examples by submitting a pull request! We're always looking for new examples that demonstrate best practices or interesting use cases.
