# Dependency Injection in NexureJS

Dependency Injection (DI) is a design pattern that allows you to implement inversion of control in your applications. NexureJS provides a built-in DI container that makes it easy to manage dependencies and write testable code.

## Basic Concepts

Dependency Injection involves three key components:

1. **Service**: A class that provides specific functionality
2. **Client**: A class that depends on the service
3. **Injector**: The system that injects the service into the client

In NexureJS, the DI container acts as the injector, automatically resolving and injecting dependencies into your classes.

## Injectable Services

To create a service that can be injected, use the `@Injectable()` decorator:

```typescript
import { Injectable } from 'nexurejs/decorators';

@Injectable()
export class UserService {
  private users = [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ];

  getUsers() {
    return this.users;
  }

  getUserById(id: number) {
    return this.users.find(user => user.id === id);
  }

  createUser(name: string) {
    const newUser = { id: this.users.length + 1, name };
    this.users.push(newUser);
    return newUser;
  }
}
```

## Using Services in Controllers

Once you've created an injectable service, you can use it in your controllers by adding it to the constructor:

```typescript
import { Controller, Get, Post, Body, Param } from 'nexurejs/decorators';
import { UserService } from './user.service';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getUsers();
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    return this.userService.getUserById(userId);
  }

  @Post()
  createUser(@Body() userData: { name: string }) {
    return this.userService.createUser(userData.name);
  }
}
```

## Registering Services and Controllers

To use dependency injection, you need to register your services and controllers with the NexureJS application:

```typescript
import { NexureApp } from 'nexurejs';
import { UserService } from './user.service';
import { UserController } from './user.controller';

const app = new NexureApp();

// Register the service
app.useService(UserService);

// Register the controller
app.useController(UserController);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Dependency Hierarchies

NexureJS supports dependency hierarchies, where services can depend on other services:

```typescript
import { Injectable } from 'nexurejs/decorators';
import { DatabaseService } from './database.service';

@Injectable()
export class UserService {
  constructor(private databaseService: DatabaseService) {}

  async getUsers() {
    return this.databaseService.query('SELECT * FROM users');
  }

  async getUserById(id: number) {
    return this.databaseService.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  async createUser(name: string) {
    return this.databaseService.query('INSERT INTO users (name) VALUES (?)', [name]);
  }
}
```

## Scoped Services

NexureJS supports different service scopes:

- **Singleton**: The default scope. The service is created once and shared across the entire application.
- **Request**: A new instance of the service is created for each request.
- **Transient**: A new instance of the service is created each time it is injected.

You can specify the scope when registering a service:

```typescript
import { NexureApp, ServiceScope } from 'nexurejs';
import { UserService } from './user.service';

const app = new NexureApp();

// Register as singleton (default)
app.useService(UserService);

// Register as request-scoped
app.useService(UserService, ServiceScope.REQUEST);

// Register as transient
app.useService(UserService, ServiceScope.TRANSIENT);
```

You can also specify the scope using the `@Injectable()` decorator:

```typescript
import { Injectable, ServiceScope } from 'nexurejs/decorators';

@Injectable({ scope: ServiceScope.REQUEST })
export class UserService {
  // ...
}
```

## Custom Providers

In some cases, you might want to provide a custom implementation of a service or use a factory function to create the service. NexureJS supports custom providers for these scenarios:

### Class Provider

```typescript
app.useService({
  provide: UserService,
  useClass: CustomUserService
});
```

### Value Provider

```typescript
app.useService({
  provide: 'CONFIG',
  useValue: {
    apiUrl: 'https://api.example.com',
    timeout: 5000
  }
});
```

### Factory Provider

```typescript
app.useService({
  provide: DatabaseService,
  useFactory: () => {
    if (process.env.NODE_ENV === 'production') {
      return new ProductionDatabaseService();
    } else {
      return new DevelopmentDatabaseService();
    }
  }
});
```

## Injecting Non-Class Dependencies

You can inject non-class dependencies using the `@Inject()` decorator:

```typescript
import { Injectable, Inject } from 'nexurejs/decorators';

@Injectable()
export class ApiService {
  constructor(@Inject('CONFIG') private config: any) {
    console.log(`API URL: ${config.apiUrl}`);
  }
}
```

## Optional Dependencies

You can mark dependencies as optional using the `@Optional()` decorator:

```typescript
import { Injectable, Optional } from 'nexurejs/decorators';
import { LoggerService } from './logger.service';

@Injectable()
export class UserService {
  constructor(@Optional() private logger?: LoggerService) {
    if (this.logger) {
      this.logger.log('UserService created');
    }
  }
}
```

## Circular Dependencies

Circular dependencies occur when two classes depend on each other. NexureJS can handle circular dependencies using forward references:

```typescript
import { Injectable, forwardRef } from 'nexurejs/decorators';
import { UserService } from './user.service';

@Injectable()
export class AuthService {
  constructor(@Inject(forwardRef(() => UserService)) private userService: UserService) {}
}
```

```typescript
import { Injectable, forwardRef } from 'nexurejs/decorators';
import { AuthService } from './auth.service';

@Injectable()
export class UserService {
  constructor(@Inject(forwardRef(() => AuthService)) private authService: AuthService) {}
}
```

## Testing with Dependency Injection

Dependency injection makes it easy to test your code by allowing you to mock dependencies:

```typescript
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let userController: UserController;
  let userService: UserService;

  beforeEach(() => {
    // Create a mock UserService
    userService = {
      getUsers: jest.fn().mockReturnValue([{ id: 1, name: 'Test User' }]),
      getUserById: jest.fn().mockReturnValue({ id: 1, name: 'Test User' }),
      createUser: jest.fn().mockImplementation((name) => ({ id: 1, name }))
    };

    // Create the controller with the mock service
    userController = new UserController(userService);
  });

  it('should get all users', () => {
    const users = userController.getAllUsers();
    expect(users).toEqual([{ id: 1, name: 'Test User' }]);
    expect(userService.getUsers).toHaveBeenCalled();
  });

  it('should get a user by ID', () => {
    const user = userController.getUserById('1');
    expect(user).toEqual({ id: 1, name: 'Test User' });
    expect(userService.getUserById).toHaveBeenCalledWith(1);
  });

  it('should create a user', () => {
    const user = userController.createUser({ name: 'New User' });
    expect(user).toEqual({ id: 1, name: 'New User' });
    expect(userService.createUser).toHaveBeenCalledWith('New User');
  });
});
```

## Modules

For larger applications, you can organize your code into modules. Each module can have its own services and controllers:

```typescript
import { Module } from 'nexurejs/decorators';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  services: [UserService],
  exports: [UserService]
})
export class UserModule {}
```

You can then register the module with your application:

```typescript
import { NexureApp } from 'nexurejs';
import { UserModule } from './user.module';

const app = new NexureApp();
app.useModule(UserModule);
app.listen(3000);
```

## Conclusion

Dependency Injection is a powerful feature of NexureJS that helps you write modular, testable, and maintainable code. By leveraging the built-in DI container, you can focus on writing business logic without worrying about managing dependencies.
