# Middleware in NexureJS

Middleware functions are functions that have access to the request object, the response object, and the next middleware function in the application's request-response cycle. Middleware can perform the following tasks:

- Execute any code
- Make changes to the request and response objects
- End the request-response cycle
- Call the next middleware function in the stack

## Basic Middleware

A middleware function takes three arguments: the request object, the response object, and the next function.

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp();

// Define a middleware function
const loggerMiddleware = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next(); // Call next to pass control to the next middleware
};

// Use the middleware
app.use(loggerMiddleware);

// Define a route
app.get('/hello', (req, res) => {
  res.send({ message: 'Hello, World!' });
});

app.listen(3000);
```

## Middleware Order

Middleware functions are executed sequentially in the order they are added to the application. This is important to remember when designing your middleware stack.

```typescript
// This middleware will be executed first
app.use((req, res, next) => {
  console.log('First middleware');
  next();
});

// This middleware will be executed second
app.use((req, res, next) => {
  console.log('Second middleware');
  next();
});

// This route handler will be executed last
app.get('/hello', (req, res) => {
  console.log('Route handler');
  res.send({ message: 'Hello, World!' });
});
```

## Route-Specific Middleware

You can apply middleware to specific routes or groups of routes:

```typescript
// Middleware for a specific route
app.get('/protected', authMiddleware, (req, res) => {
  res.send({ message: 'Protected route' });
});

// Multiple middleware for a route
app.get('/admin', authMiddleware, adminMiddleware, (req, res) => {
  res.send({ message: 'Admin route' });
});
```

## Router-Level Middleware

You can also apply middleware to a router instance:

```typescript
import { NexureApp, Router } from 'nexurejs';

const app = new NexureApp();
const apiRouter = new Router();

// Apply middleware to all routes in this router
apiRouter.use(authMiddleware);

apiRouter.get('/users', (req, res) => {
  res.send({ users: [] });
});

apiRouter.get('/posts', (req, res) => {
  res.send({ posts: [] });
});

// Use the router with a prefix
app.use('/api', apiRouter);
```

## Error-Handling Middleware

Error-handling middleware takes four arguments instead of three: (err, req, res, next).

```typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Something went wrong!' });
});
```

To trigger the error-handling middleware, you can either:

1. Throw an error in a route handler or middleware:

```typescript
app.get('/error', (req, res) => {
  throw new Error('Something went wrong');
});
```

2. Pass an error to the next function:

```typescript
app.get('/error', (req, res, next) => {
  next(new Error('Something went wrong'));
});
```

## Built-in Middleware

NexureJS includes several built-in middleware functions:

### Body Parser

Parses incoming request bodies and makes them available under `req.body`.

```typescript
import { NexureApp, bodyParser } from 'nexurejs';

const app = new NexureApp();

// Parse JSON bodies
app.use(bodyParser.json());

// Parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/users', (req, res) => {
  console.log(req.body); // Access the parsed request body
  res.send({ message: 'User created' });
});
```

### CORS

Enables Cross-Origin Resource Sharing (CORS) with various options.

```typescript
import { NexureApp, cors } from 'nexurejs';

const app = new NexureApp();

// Enable CORS for all routes
app.use(cors());

// Enable CORS with specific options
app.use(cors({
  origin: 'https://example.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### Compression

Compresses response bodies for all requests that traverse through the middleware.

```typescript
import { NexureApp, compression } from 'nexurejs';

const app = new NexureApp();

// Enable compression
app.use(compression());
```

### Static Files

Serves static files from a specified directory.

```typescript
import { NexureApp, staticFiles } from 'nexurejs';
import path from 'path';

const app = new NexureApp();

// Serve static files from the 'public' directory
app.use(staticFiles(path.join(__dirname, 'public')));
```

## Custom Middleware

You can create your own middleware functions to handle specific tasks:

### Authentication Middleware

```typescript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' });
  }

  try {
    // Verify the token
    const decoded = verifyToken(token);
    req.user = decoded; // Attach the user to the request
    next();
  } catch (error) {
    res.status(401).send({ message: 'Invalid token' });
  }
};
```

### Rate Limiting Middleware

```typescript
const rateLimiter = (options) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!requests.has(ip)) {
      requests.set(ip, []);
    }

    const userRequests = requests.get(ip);

    // Remove requests older than the window
    const windowMs = options.windowMs || 60000; // Default: 1 minute
    const validRequests = userRequests.filter(time => now - time < windowMs);
    requests.set(ip, validRequests);

    // Check if the user has exceeded the limit
    const maxRequests = options.max || 100; // Default: 100 requests per window
    if (validRequests.length >= maxRequests) {
      return res.status(429).send({
        message: 'Too many requests, please try again later.'
      });
    }

    // Add the current request
    validRequests.push(now);
    requests.set(ip, validRequests);

    next();
  };
};

// Use the rate limiter
app.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 minutes
}));
```

### Logging Middleware

```typescript
const logger = (options) => {
  return (req, res, next) => {
    const start = Date.now();

    // Capture the original end method
    const originalEnd = res.end;

    // Override the end method
    res.end = function(...args) {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`;

      if (options.console) {
        console.log(logMessage);
      }

      if (options.file) {
        // Log to file
        fs.appendFileSync(options.file, logMessage + '\n');
      }

      // Call the original end method
      originalEnd.apply(res, args);
    };

    next();
  };
};

// Use the logger
app.use(logger({
  console: true,
  file: 'access.log'
}));
```

## Middleware with Async/Await

You can use async/await in middleware functions:

```typescript
const asyncMiddleware = async (req, res, next) => {
  try {
    const data = await fetchDataFromDatabase();
    req.data = data;
    next();
  } catch (error) {
    next(error);
  }
};

app.use(asyncMiddleware);
```

## Middleware Composition

You can compose multiple middleware functions into a single middleware:

```typescript
const compose = (...middlewares) => {
  return (req, res, next) => {
    const dispatch = (i) => {
      if (i >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[i];
      try {
        middleware(req, res, () => dispatch(i + 1));
      } catch (error) {
        next(error);
      }
    };

    dispatch(0);
  };
};

// Use composed middleware
app.use(compose(
  loggerMiddleware,
  authMiddleware,
  rateLimiter({ max: 100 })
));
```

## Conclusion

Middleware is a powerful concept in NexureJS that allows you to modularize your application logic and apply it selectively to routes. By understanding how middleware works, you can create more maintainable and flexible applications.
