import 'reflect-metadata';
import { Nexure, Controller, Get, Post, Injectable, HttpException } from '../../src/index.js';

// Define the request context type
interface RequestContext {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  req?: any;
  res?: any;
}

// Create a service
@Injectable()
class GreetingService {
  getGreeting(name: string): string {
    return `Hello, ${name}!`;
  }
}

// Create a controller
@Controller('/hello')
class HelloController {
  constructor(private greetingService: GreetingService) {}

  @Get('/')
  sayHello() {
    return { message: 'Hello, NexureJS!' };
  }

  @Get('/:name')
  greet({ params }: RequestContext) {
    const name = params?.name || 'World';
    return { message: this.greetingService.getGreeting(name) };
  }

  @Post('/')
  createGreeting({ body }: RequestContext) {
    if (!body?.name) {
      throw HttpException.badRequest('Name is required');
    }

    return {
      message: this.greetingService.getGreeting(body.name),
      created: new Date().toISOString()
    };
  }
}

// Create the application
const app = new Nexure({
  logging: true,
  prettyJson: true
});

// Register the controller
app.register(HelloController);

// Start the server
app.listen(3000, () => {
  console.log('Example app is running at http://localhost:3000/');
  console.log('Try the following routes:');
  console.log('  GET  /hello');
  console.log('  GET  /hello/:name');
  console.log('  POST /hello  (with JSON body: { "name": "Your Name" })');
});
