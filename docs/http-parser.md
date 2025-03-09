# HTTP Parser

The HTTP Parser in NexureJS is responsible for parsing HTTP requests. It provides both a standard parser for complete requests and a streaming parser for handling requests in chunks.

## Features

- **High Performance**: Optimized C++ implementation for maximum speed
- **Streaming Support**: Parse HTTP requests in chunks
- **JavaScript Fallback**: Automatic fallback to JavaScript implementation if native module is not available
- **Performance Metrics**: Built-in metrics for comparing native and JavaScript implementations

## Usage

### Standard HTTP Parser

The standard HTTP parser is used for parsing complete HTTP requests:

```typescript
import { HttpParser } from 'nexurejs/native';

const httpParser = new HttpParser();

// Create a sample HTTP request
const buffer = Buffer.from(
  'GET /api/users?page=1 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 26\r\n' +
  '\r\n' +
  '{"name":"John","age":30}'
);

// Parse the request
const result = httpParser.parse(buffer);

console.log(result);
// {
//   method: 'GET',
//   url: '/api/users?page=1',
//   httpVersion: '1.1',
//   headers: {
//     host: 'example.com',
//     'user-agent': 'Mozilla/5.0',
//     accept: 'application/json',
//     'content-type': 'application/json',
//     'content-length': '26'
//   },
//   body: <Buffer 7b 22 6e 61 6d 65 22 3a 22 4a 6f 68 6e 22 2c 22 61 67 65 22 3a 33 30 7d>,
//   complete: true
// }

// Reset the parser for the next request
httpParser.reset();
```

### Streaming HTTP Parser

The streaming HTTP parser is used for parsing HTTP requests in chunks:

```typescript
import { HttpStreamParser } from 'nexurejs/http';

const streamParser = new HttpStreamParser();

// Split the request into chunks
const chunk1 = buffer.slice(0, 50);
const chunk2 = buffer.slice(50, 100);
const chunk3 = buffer.slice(100);

// Process the first chunk
streamParser.write(chunk1);
console.log('Chunk 1 processed, state:', streamParser.getState());
// { headersParsed: false, contentLength: 0, bufferLength: 50 }

// Process the second chunk
streamParser.write(chunk2);
console.log('Chunk 2 processed, state:', streamParser.getState());
// { headersParsed: true, contentLength: 26, bufferLength: 100 }

// Process the third chunk
streamParser.write(chunk3);
console.log('Chunk 3 processed, state:', streamParser.getState());
// { headersParsed: true, contentLength: 26, bufferLength: 126 }

// Get the parsed result
const result = streamParser.getResult();
console.log('Result:', result);

// Reset the parser for the next request
streamParser.reset();
```

## API Reference

### HttpParser

#### Constructor

```typescript
constructor()
```

Creates a new HTTP parser instance.

#### Methods

##### parse(buffer: Buffer): HttpParseResult

Parses a complete HTTP request.

- **buffer**: The HTTP request buffer to parse
- **Returns**: An object containing the parsed HTTP request

##### reset(): void

Resets the parser state for parsing a new request.

### HttpStreamParser

#### Constructor

```typescript
constructor()
```

Creates a new HTTP stream parser instance.

#### Methods

##### write(chunk: Buffer): HttpParseResult | null

Processes a chunk of an HTTP request.

- **chunk**: A buffer containing a portion of an HTTP request
- **Returns**: The parsed HTTP request if complete, or null if more data is needed

##### reset(): void

Resets the parser state for parsing a new request.

##### getBuffer(): Buffer

Gets the current buffer containing all processed chunks.

##### getState(): { headersParsed: boolean; contentLength: number; bufferLength: number }

Gets the current state of the parser.

##### getResult(): HttpParseResult | null

Gets the parsed result if the request is complete, or null if more data is needed.

### HttpParseResult

```typescript
interface HttpParseResult {
  method: string;
  url: string;
  httpVersion: string;
  headers: Record<string, string>;
  body: Buffer | null;
  complete: boolean;
}
```

## Performance Metrics

You can get performance metrics for the HTTP parser:

```typescript
import { HttpParser } from 'nexurejs/native';

// Reset metrics
HttpParser.resetPerformanceMetrics();

// Use the parser...
const httpParser = new HttpParser();
httpParser.parse(buffer);

// Get metrics
const metrics = HttpParser.getPerformanceMetrics();
console.log(metrics);
```

## Benchmarking

You can run benchmarks to compare the performance of the native and JavaScript implementations:

```bash
npm run benchmark:http
```

## Implementation Details

The HTTP parser is implemented in C++ for maximum performance. It uses a state machine to parse HTTP requests efficiently. The parser handles:

- Request line (method, URL, HTTP version)
- Headers (name-value pairs)
- Body (based on Content-Length or Transfer-Encoding)

The JavaScript implementation provides a fallback in case the native module is not available.
