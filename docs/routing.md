# Routing in NexureJS

Routing is a core feature of NexureJS that determines how an application responds to client requests to specific endpoints, which are URIs (or paths) and HTTP methods (GET, POST, etc.).

## Basic Routing

The most basic route definition takes the following form:

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp();

app.get('/hello', (req, res) => {
  res.send({ message: 'Hello, World!' });
});

app.post('/users', (req, res) => {
  // Create a new user
  res.send({ message: 'User created' });
});
```

## Route Parameters

Route parameters are named URL segments used to capture values at specific positions in the URL. The captured values are stored in the `req.params` object.

```typescript
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.send({ message: `User ID: ${userId}` });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.send({ userId, postId });
});
```

## Query Parameters

Query parameters are specified after the `?` in the URL and are accessible via the `req.query` object.

```typescript
// URL: /search?q=nexurejs&limit=10
app.get('/search', (req, res) => {
  const query = req.query.q;
  const limit = req.query.limit;
  res.send({ query, limit });
});
```

## Route Handlers

Route handlers are functions that are executed when a matching route is found. They have access to the request and response objects.

```typescript
app.get('/hello', (req, res) => {
  // Request object contains information about the HTTP request
  console.log(req.method); // GET
  console.log(req.url); // /hello
  console.log(req.headers); // HTTP headers

  // Response object is used to send a response to the client
  res.status(200); // Set HTTP status code
  res.header('Content-Type', 'application/json'); // Set response header
  res.send({ message: 'Hello, World!' }); // Send JSON response
});
```

## Controller-based Routing

NexureJS supports controller-based routing using decorators, which provides a more structured approach to defining routes.

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body } from 'nexurejs/decorators';
import { NexureApp } from 'nexurejs';

@Controller('/users')
class UserController {
  private users = [
    { id: '1', name: 'John' },
    { id: '2', name: 'Jane' }
  ];

  @Get()
  getAllUsers() {
    return this.users;
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    return this.users.find(user => user.id === id);
  }

  @Post()
  createUser(@Body() userData: any) {
    const newUser = { id: Date.now().toString(), ...userData };
    this.users.push(newUser);
    return newUser;
  }

  @Put('/:id')
  updateUser(@Param('id') id: string, @Body() userData: any) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const updatedUser = { ...this.users[userIndex], ...userData };
    this.users[userIndex] = updatedUser;
    return updatedUser;
  }

  @Delete('/:id')
  deleteUser(@Param('id') id: string) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const deletedUser = this.users[userIndex];
    this.users.splice(userIndex, 1);
    return deletedUser;
  }
}

const app = new NexureApp();
app.useController(UserController);
```

## Route Decorators

NexureJS provides several decorators for defining routes in controllers:

- `@Get(path?)` - Handles HTTP GET requests
- `@Post(path?)` - Handles HTTP POST requests
- `@Put(path?)` - Handles HTTP PUT requests
- `@Patch(path?)` - Handles HTTP PATCH requests
- `@Delete(path?)` - Handles HTTP DELETE requests
- `@Head(path?)` - Handles HTTP HEAD requests
- `@Options(path?)` - Handles HTTP OPTIONS requests
- `@All(path?)` - Handles all HTTP methods

## Parameter Decorators

Parameter decorators are used to extract data from the request:

- `@Param(name?)` - Extracts route parameters
- `@Query(name?)` - Extracts query parameters
- `@Body(name?)` - Extracts request body
- `@Header(name?)` - Extracts request headers
- `@Req()` - Injects the request object
- `@Res()` - Injects the response object

## Route Groups

You can group related routes together using the `Router` class:

```typescript
import { NexureApp, Router } from 'nexurejs';

const app = new NexureApp();
const apiRouter = new Router();

// Define routes on the router
apiRouter.get('/users', (req, res) => {
  res.send({ users: [] });
});

apiRouter.get('/posts', (req, res) => {
  res.send({ posts: [] });
});

// Use the router with a prefix
app.use('/api', apiRouter);

// Now routes are accessible at /api/users and /api/posts
```

## Route Middleware

Middleware can be applied to specific routes or groups of routes:

```typescript
// Middleware function
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' });
  }
  // Validate token...
  next();
};

// Apply middleware to a single route
app.get('/protected', authMiddleware, (req, res) => {
  res.send({ message: 'Protected route' });
});

// Apply middleware to all routes in a router
const adminRouter = new Router();
adminRouter.use(authMiddleware);

adminRouter.get('/dashboard', (req, res) => {
  res.send({ message: 'Admin dashboard' });
});

app.use('/admin', adminRouter);
```

## Route Patterns

NexureJS supports various route patterns:

```typescript
// Simple route
app.get('/users', handler);

// Route with named parameter
app.get('/users/:id', handler);

// Route with optional parameter
app.get('/users/:id?', handler);

// Route with wildcard
app.get('/files/*', handler);

// Regular expression route
app.get(/^\/users\/(\d+)$/, handler);
```

## Advanced Routing with Radix Router

NexureJS uses a high-performance radix tree-based router under the hood, which provides fast route matching and parameter extraction. The router is optimized for both static and dynamic routes.

For even better performance, NexureJS includes a native C++ implementation of the radix router that can be used as a drop-in replacement for the JavaScript implementation.

```typescript
import { NexureApp } from 'nexurejs';
import { RadixRouter } from 'nexurejs/native';

const app = new NexureApp({
  router: new RadixRouter()
});
```

## Error Handling in Routes

You can handle errors in routes using try-catch blocks or by using the error handling middleware:

```typescript
// Using try-catch in a route handler
app.get('/users/:id', (req, res) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Using error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Something went wrong!' });
});
```

## Conclusion

NexureJS provides a flexible and powerful routing system that can handle simple to complex routing requirements. Whether you prefer the traditional Express-like approach or the more structured controller-based approach, NexureJS has you covered.

# Radix Router

The Radix Router in NexureJS is a high-performance routing system based on a radix tree (also known as a prefix tree or trie). It provides efficient URL matching and parameter extraction.

## Features

- **High Performance**: Optimized C++ implementation for maximum speed
- **Parameter Extraction**: Automatically extracts parameters from URL paths
- **Route Caching**: Caches route lookups for even faster performance
- **JavaScript Fallback**: Automatic fallback to JavaScript implementation if native module is not available
- **Performance Metrics**: Built-in metrics for comparing native and JavaScript implementations

## Usage

### Basic Usage

```typescript
import { RadixRouter } from 'nexurejs/native';

// Create a new router
const router = new RadixRouter();

// Add routes
router.add('GET', '/api/users', getUsersHandler);
router.add('GET', '/api/users/:id', getUserByIdHandler);
router.add('GET', '/api/posts', getPostsHandler);
router.add('GET', '/api/posts/:id', getPostByIdHandler);
router.add('GET', '/api/posts/:id/comments', getPostCommentsHandler);

// Find a route
const match = router.find('GET', '/api/users/123');

console.log(match);
// {
//   handler: getUserByIdHandler,
//   params: { id: '123' },
//   found: true
// }

// Find another route
const match2 = router.find('GET', '/api/posts/456/comments');

console.log(match2);
// {
//   handler: getPostCommentsHandler,
//   params: { id: '456' },
//   found: true
// }

// Route not found
const match3 = router.find('GET', '/api/unknown');

console.log(match3);
// {
//   handler: null,
//   params: {},
//   found: false
// }
```

### Removing Routes

```typescript
import { RadixRouter } from 'nexurejs/native';

const router = new RadixRouter();

// Add a route
router.add('GET', '/api/users/:id', getUserByIdHandler);

// Find the route
const match = router.find('GET', '/api/users/123');
console.log(match.found); // true

// Remove the route
const removed = router.remove('GET', '/api/users/:id');
console.log(removed); // true

// Try to find the route again
const match2 = router.find('GET', '/api/users/123');
console.log(match2.found); // false
```

## API Reference

### RadixRouter

#### Constructor

```typescript
constructor(options?: { maxCacheSize?: number })
```

Creates a new RadixRouter instance.

- **options.maxCacheSize**: Maximum number of routes to cache (default: 1000)

#### Methods

##### add(method: string, path: string, handler: any): this

Adds a route to the router.

- **method**: The HTTP method (GET, POST, etc.)
- **path**: The URL path pattern
- **handler**: The handler to associate with the route
- **Returns**: The router instance for chaining

##### find(method: string, path: string): RouteMatch

Finds a route matching the given method and path.

- **method**: The HTTP method (GET, POST, etc.)
- **path**: The URL path to match
- **Returns**: A RouteMatch object

##### remove(method: string, path: string): boolean

Removes a route from the router.

- **method**: The HTTP method (GET, POST, etc.)
- **path**: The URL path pattern to remove
- **Returns**: true if the route was removed, false otherwise

#### Static Methods

##### getPerformanceMetrics(): object

Gets performance metrics for the RadixRouter.

##### resetPerformanceMetrics(): void

Resets performance metrics for the RadixRouter.

### RouteMatch

```typescript
interface RouteMatch {
  handler: any;
  params: Record<string, string>;
  found: boolean;
}
```

## Performance Metrics

You can get performance metrics for the RadixRouter:

```typescript
import { RadixRouter } from 'nexurejs/native';

// Reset metrics
RadixRouter.resetPerformanceMetrics();

// Use the router...
const router = new RadixRouter();
router.add('GET', '/api/users/:id', getUserByIdHandler);
router.find('GET', '/api/users/123');

// Get metrics
const metrics = RadixRouter.getPerformanceMetrics();
console.log(metrics);
```

## Benchmarking

You can run benchmarks to compare the performance of the native and JavaScript implementations:

```bash
npm run benchmark:router
```

## Implementation Details

The RadixRouter is implemented in C++ for maximum performance. It uses a radix tree data structure to efficiently match URL paths. The router handles:

- Static routes (e.g., `/api/users`)
- Parameterized routes (e.g., `/api/users/:id`)
- Mixed routes (e.g., `/api/users/:id/posts`)

The JavaScript implementation provides a fallback in case the native module is not available.

## How It Works

A radix tree is a space-optimized tree structure where each node represents a common prefix of a set of strings. In the context of URL routing:

1. Each node in the tree represents a segment of a URL path
2. Child nodes represent possible continuations of the path
3. Parameters (`:id`) are treated as special nodes that can match any value
4. When finding a route, the router traverses the tree to find the best match
5. If a match is found, the router extracts parameters from the path

This approach is much more efficient than linear matching, especially for large numbers of routes.
