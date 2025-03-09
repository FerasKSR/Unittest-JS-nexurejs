# NexureJS Quick Start Guide

This guide will help you get started with NexureJS quickly and build your first application.

## Installation

Start by creating a new Node.js project:

```bash
mkdir my-nexure-app
cd my-nexure-app
npm init -y
```

Install NexureJS and TypeScript:

```bash
npm install nexurejs typescript ts-node @types/node
```

Initialize TypeScript configuration:

```bash
npx tsc --init
```

Edit `tsconfig.json` to include:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Create a Simple Application

Create a new file at `src/app.ts`:

```typescript
import { NexureApp } from 'nexurejs';

// Create a new application instance
const app = new NexureApp();

// Define a simple route
app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
```

## Run Your Application

Add a start script to your `package.json`:

```json
{
  "scripts": {
    "start": "ts-node src/app.ts",
    "build": "tsc",
    "serve": "node dist/app.js"
  }
}
```

Now run your application:

```bash
npm start
```

Visit `http://localhost:3000/hello` in your browser to see "Hello, World!"

## Working with JSON

Handling JSON is simple with NexureJS:

```typescript
// Add a JSON endpoint
app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  res.json(users);
});

// Handle POST requests with JSON body
app.post('/api/users', (req, res) => {
  // Request body is automatically parsed
  const newUser = req.body;

  // Validate the user (simple validation)
  if (!newUser.name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // In a real app, you would save to a database
  console.log('Created user:', newUser);

  res.status(201).json({
    id: Math.floor(Math.random() * 1000),
    ...newUser
  });
});
```

## Using Controllers

For a more structured approach, use controller classes:

```typescript
// src/controllers/user-controller.ts
import { Controller, Get, Post, Body, Param } from 'nexurejs';

interface User {
  id: number;
  name: string;
}

@Controller('/api/users')
export class UserController {
  private users: User[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  @Get()
  getAllUsers() {
    return this.users;
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    const user = this.users.find(u => u.id === userId);

    if (!user) {
      return { status: 404, body: { error: 'User not found' } };
    }

    return user;
  }

  @Post()
  createUser(@Body() userData: { name: string }) {
    if (!userData.name) {
      return { status: 400, body: { error: 'Name is required' } };
    }

    const newUser: User = {
      id: Math.floor(Math.random() * 1000),
      name: userData.name
    };

    this.users.push(newUser);
    return { status: 201, body: newUser };
  }
}
```

Register the controller in your app:

```typescript
// src/app.ts
import { NexureApp } from 'nexurejs';
import { UserController } from './controllers/user-controller';

const app = new NexureApp();

// Register controllers
app.registerController(UserController);

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
```

## Using Middleware

Middleware functions can process requests before they reach route handlers:

```typescript
// src/middleware/logger.ts
import { Middleware, NextFunction, Request, Response } from 'nexurejs';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
}

// src/middleware/auth.ts
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== 'your-secret-key') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
```

Apply middleware to your app or specific routes:

```typescript
// Apply globally
app.use(loggerMiddleware);

// Apply to specific routes
app.get('/protected', authMiddleware, (req, res) => {
  res.send('Protected content');
});

// Apply to controllers
@Controller('/admin')
@UseMiddleware(authMiddleware)
export class AdminController {
  // All routes will use authMiddleware
}
```

## Error Handling

Set up error handling for your application:

```typescript
// Global error handler
app.setErrorHandler((err, req, res) => {
  console.error('Application error:', err);

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Route that might throw an error
app.get('/error-example', (req, res) => {
  try {
    // Something that might fail
    throw new Error('Something went wrong');
  } catch (err) {
    // Forward to the global error handler
    throw err;
  }
});
```

## Production Setup

For production, enable performance optimizations:

```typescript
const app = new NexureApp({
  environment: process.env.NODE_ENV || 'development',
  performance: {
    // Only enable in production
    ...(process.env.NODE_ENV === 'production' ? {
      radixRouter: {
        type: 'optimized',
        cacheEnabled: true
      },
      http: {
        parser: {
          type: 'zero-copy'
        },
        pooling: {
          enabled: true
        }
      }
    } : {})
  }
});
```

## Next Steps

This quick start guide covers the basics to get you up and running with NexureJS. To learn more:

1. Read the [Framework Guide](./framework-guide.md) for a complete overview
2. Explore the [Performance Optimization Guide](./performance-optimization-guide.md) for production tuning
3. Check the [API Reference](./api-reference.md) for detailed documentation

Happy coding with NexureJS!
