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
