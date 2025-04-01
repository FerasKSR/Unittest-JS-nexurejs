/**
 * Security Example
 *
 * This example demonstrates how to implement robust security measures in NexureJS:
 * - Security headers implementation
 * - CSRF protection
 * - Rate limiting
 * - Input validation
 * - Proper error handling
 *
 * For complete API documentation, see:
 * - API Reference: ../../docs/API_REFERENCE.md
 * - Examples Guide: ../../docs/EXAMPLES.md
 */

import 'reflect-metadata';
import {
  Nexure,
  Controller,
  Get,
  Post,
  Use,
  Injectable,
  HttpException,
  createSecurityHeadersMiddleware,
  createCsrfMiddleware,
  createCsrfTokenMiddleware,
  createRateLimiterMiddleware,
  validateBody,
  validateQuery,
  ValidationSchema
} from '../../src/index.js';

// Create a service
@Injectable()
class UserService {
  private users = [
    { id: 1, username: 'admin', email: 'admin@example.com' },
    { id: 2, username: 'user', email: 'user@example.com' }
  ];

  getUsers() {
    return this.users;
  }

  getUserById(id: number) {
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw HttpException.notFound(`User with ID ${id} not found`);
    }
    return user;
  }

  getUserByUsername(username: string) {
    const user = this.users.find(user => user.username === username);
    if (!user) {
      throw HttpException.notFound(`User with username ${username} not found`);
    }
    return user;
  }

  createUser(data: any) {
    // Validate data
    if (!data.username || !data.email) {
      throw HttpException.badRequest('Username and email are required');
    }

    // Check if username already exists
    if (this.users.some(user => user.username === data.username)) {
      throw HttpException.conflict(`Username ${data.username} already exists`);
    }

    // Create user
    const newUser = {
      id: this.users.length + 1,
      username: data.username,
      email: data.email
    };

    this.users.push(newUser);
    return newUser;
  }
}

// Create validation schemas
const createUserSchema: ValidationSchema = {
  username: [
    { type: 'required', message: 'Username is required' },
    { type: 'string', message: 'Username must be a string' },
    { type: 'min', params: { min: 3 }, message: 'Username must be at least 3 characters' },
    { type: 'max', params: { max: 20 }, message: 'Username must be at most 20 characters' },
    { type: 'pattern', params: { pattern: '^[a-zA-Z0-9_]+$' }, message: 'Username can only contain letters, numbers, and underscores' }
  ],
  email: [
    { type: 'required', message: 'Email is required' },
    { type: 'string', message: 'Email must be a string' },
    { type: 'email', message: 'Email must be a valid email address' }
  ]
};

const getUserQuerySchema: ValidationSchema = {
  id: [
    { type: 'sanitize:toNumber' },
    { type: 'number', message: 'ID must be a number' }
  ]
};

// Create a controller
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  getUsers() {
    return this.userService.getUsers();
  }

  @Get('/:id')
  @Use(validateQuery(getUserQuerySchema))
  getUserById({ params }: { params: any }) {
    const id = parseInt(params.id, 10);
    return this.userService.getUserById(id);
  }

  @Post('/')
  @Use(validateBody(createUserSchema))
  createUser({ body }: { body: any }) {
    return this.userService.createUser(body);
  }
}

// Create the application
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Add security headers middleware
app.use(createSecurityHeadersMiddleware({
  contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'",
  frameOptions: 'DENY',
  contentTypeOptions: 'nosniff',
  xssProtection: '1; mode=block',
  referrerPolicy: 'no-referrer'
}));

// Add CSRF protection middleware
app.use(createCsrfMiddleware({
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
}));

// Add CSRF token middleware
app.use(createCsrfTokenMiddleware());

// Add rate limiting middleware
app.use(createRateLimiterMiddleware({
  max: 100,
  windowMs: 60000, // 1 minute
  message: 'Too many requests from this IP, please try again after a minute'
}));

// Register the controller
app.register(UserController);

// Start the server
app.listen(3000, () => {
  console.log('Security example app is running at http://localhost:3000/');
  console.log('Try the following routes:');
  console.log('  GET  /users');
  console.log('  GET  /users/:id');
  console.log('  POST /users (with CSRF token in header and valid JSON body)');
});
