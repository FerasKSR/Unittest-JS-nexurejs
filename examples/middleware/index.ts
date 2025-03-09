import 'reflect-metadata';
import {
  Nexure,
  Controller,
  Get,
  Post,
  Use,
  Injectable,
  HttpException,
  MiddlewareHandler,
  Middleware
} from '../../src/index.js';
import { IncomingMessage, ServerResponse } from 'node:http';

// Define the request context type
interface RequestContext {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  user?: any;
  req?: any;
  res?: any;
}

// Create a logging middleware
const loggingMiddleware: MiddlewareHandler = async (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  await next();
};

// Create an authentication middleware class
@Injectable()
class AuthMiddleware extends Middleware {
  async use(req: IncomingMessage, res: ServerResponse, next: () => Promise<void>): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw HttpException.unauthorized('Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];

    // In a real app, you would validate the token
    // For this example, we'll just check if it's 'secret-token'
    if (token !== 'secret-token') {
      throw HttpException.unauthorized('Invalid token');
    }

    // Add user info to request
    (req as any).user = { id: 1, name: 'Admin' };

    await next();
  }
}

// Create a service
@Injectable()
class UserService {
  private users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
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

  createUser(data: any) {
    const newUser = {
      id: this.users.length + 1,
      name: data.name,
      email: data.email
    };

    this.users.push(newUser);
    return newUser;
  }
}

// Create a public controller
@Controller('/public')
@Use(loggingMiddleware)
class PublicController {
  @Get('/')
  getPublicInfo() {
    return { message: 'This is public information' };
  }
}

// Create a protected controller
@Controller('/users')
@Use(loggingMiddleware)
class UserController {
  constructor(
    private userService: UserService,
    private authMiddleware: AuthMiddleware
  ) {}

  private authMiddlewareHandler: MiddlewareHandler = (req, res, next) => {
    return this.authMiddleware.use(req, res, next);
  };

  @Get('/')
  @Use(function(this: UserController, req, res, next) {
    return this.authMiddleware.use(req, res, next);
  })
  getUsers() {
    return this.userService.getUsers();
  }

  @Get('/:id')
  @Use(function(this: UserController, req, res, next) {
    return this.authMiddleware.use(req, res, next);
  })
  getUserById({ params }: RequestContext) {
    const id = parseInt(params?.id || '0', 10);
    return this.userService.getUserById(id);
  }

  @Post('/')
  @Use(function(this: UserController, req, res, next) {
    return this.authMiddleware.use(req, res, next);
  })
  createUser({ body, user }: RequestContext) {
    if (!body?.name || !body?.email) {
      throw HttpException.badRequest('Name and email are required');
    }

    const newUser = this.userService.createUser(body);

    return {
      message: 'User created successfully',
      user: newUser,
      createdBy: user?.name || 'Unknown'
    };
  }
}

// Create the application
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Register controllers
app.register(PublicController);
app.register(UserController);

// Start the server
app.listen(3000, () => {
  console.log('Middleware example app is running at http://localhost:3000/');
  console.log('Try the following routes:');
  console.log('  GET  /public');
  console.log('  GET  /users (requires Authorization: Bearer secret-token header)');
  console.log('  GET  /users/:id (requires Authorization: Bearer secret-token header)');
  console.log('  POST /users (requires Authorization: Bearer secret-token header and JSON body: { "name": "Name", "email": "email@example.com" })');
});
