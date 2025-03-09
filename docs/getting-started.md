# Getting Started with NexureJS

This guide will help you get started with NexureJS, a high-performance, modular Node.js framework with modern developer experience.

## Prerequisites

Before you begin, make sure you have the following installed:

- Node.js (version 18.x or later)
- npm (version 7.x or later)

## Installation

You can install NexureJS using npm:

```bash
npm install nexurejs
```

For TypeScript projects, you'll also want to install TypeScript and the required type definitions:

```bash
npm install typescript @types/node --save-dev
```

## Creating Your First Application

Let's create a simple "Hello World" application with NexureJS.

### 1. Create a new project

```bash
mkdir my-nexure-app
cd my-nexure-app
npm init -y
npm install nexurejs typescript @types/node --save-dev
```

### 2. Configure TypeScript

Create a `tsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Create a basic application

Create a `src` directory and add an `app.ts` file:

```typescript
import { NexureApp } from 'nexurejs';
import { Controller, Get } from 'nexurejs/decorators';

@Controller('/hello')
class HelloController {
  @Get()
  sayHello() {
    return { message: 'Hello, NexureJS!' };
  }

  @Get('/:name')
  greet(req: any) {
    const name = req.params.name;
    return { message: `Hello, ${name}!` };
  }
}

const app = new NexureApp();
app.useController(HelloController);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### 4. Add npm scripts

Update your `package.json` file to include the following scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "ts-node src/app.ts",
    "watch": "nodemon --exec ts-node src/app.ts"
  }
}
```

You may need to install additional dependencies:

```bash
npm install ts-node nodemon --save-dev
```

### 5. Run your application

Start your application in development mode:

```bash
npm run dev
```

Visit `http://localhost:3000/hello` in your browser, and you should see:

```json
{
  "message": "Hello, NexureJS!"
}
```

Try visiting `http://localhost:3000/hello/world` to see:

```json
{
  "message": "Hello, world!"
}
```

## Core Concepts

### Application

The `NexureApp` class is the main entry point for your application. It handles HTTP requests, routing, and middleware.

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp();
app.listen(3000);
```

### Controllers

Controllers handle incoming requests and return responses. They are decorated with the `@Controller` decorator to define the base route.

```typescript
import { Controller, Get, Post } from 'nexurejs/decorators';

@Controller('/users')
class UserController {
  @Get()
  getAllUsers() {
    // Return all users
  }

  @Get('/:id')
  getUserById(req: any) {
    // Return user by ID
  }

  @Post()
  createUser(req: any) {
    // Create a new user
  }
}
```

### Middleware

Middleware functions process requests before they reach the route handlers. They can modify the request and response objects, end the request-response cycle, or call the next middleware function.

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp();

// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Route-specific middleware
app.get('/protected', authMiddleware, (req, res) => {
  res.send({ message: 'Protected route' });
});
```

### Dependency Injection

NexureJS includes a built-in dependency injection system that makes it easy to manage dependencies and write testable code.

```typescript
import { Injectable } from 'nexurejs/decorators';
import { NexureApp } from 'nexurejs';

@Injectable()
class UserService {
  getUsers() {
    return [{ id: 1, name: 'John' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getUsers();
  }
}

const app = new NexureApp();
app.useController(UserController);
```

## Next Steps

Now that you've created your first NexureJS application, you can explore more advanced features:

- [Routing](routing.md) - Learn more about routing in NexureJS
- [Middleware](middleware.md) - Explore middleware concepts and examples
- [Dependency Injection](dependency-injection.md) - Dive deeper into dependency injection
- [Performance Optimization](performance-optimization.md) - Optimize your application for production

For a complete API reference, see the [API Reference](api-reference.md) documentation.
