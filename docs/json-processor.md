# JSON Processor

The JSON Processor in NexureJS is a high-performance JSON parsing and stringification module. It provides significant performance improvements over the built-in `JSON.parse` and `JSON.stringify` methods.

## Features

- **High Performance**: Optimized C++ implementation for maximum speed
- **Buffer Support**: Parse JSON directly from Buffer objects without conversion
- **JavaScript Fallback**: Automatic fallback to JavaScript implementation if native module is not available
- **Performance Metrics**: Built-in metrics for comparing native and JavaScript implementations

## Usage

### Basic Usage

```typescript
import { JsonProcessor } from 'nexurejs/native';

// Create a new JSON processor
const jsonProcessor = new JsonProcessor();

// Parse JSON from string
const jsonString = '{"name":"John","age":30,"isActive":true,"skills":["JavaScript","TypeScript","Node.js"]}';
const parsed = jsonProcessor.parse(jsonString);

console.log(parsed);
// {
//   name: 'John',
//   age: 30,
//   isActive: true,
//   skills: [ 'JavaScript', 'TypeScript', 'Node.js' ]
// }

// Parse JSON from Buffer
const jsonBuffer = Buffer.from(jsonString);
const parsedFromBuffer = jsonProcessor.parse(jsonBuffer);

// Stringify JSON
const obj = {
  name: 'John',
  age: 30,
  isActive: true,
  skills: ['JavaScript', 'TypeScript', 'Node.js']
};
const stringified = jsonProcessor.stringify(obj);

console.log(stringified);
// '{"name":"John","age":30,"isActive":true,"skills":["JavaScript","TypeScript","Node.js"]}'
```

### Parsing JSON Streams

```typescript
import { JsonProcessor } from 'nexurejs/native';

const jsonProcessor = new JsonProcessor();

// JSON Lines format (one JSON object per line)
const jsonLines = Buffer.from(
  '{"id":1,"name":"John"}\n' +
  '{"id":2,"name":"Jane"}\n' +
  '{"id":3,"name":"Bob"}'
);

// Parse JSON stream
const parsedLines = jsonProcessor.parseStream(jsonLines);

console.log(parsedLines);
// [
//   { id: 1, name: 'John' },
//   { id: 2, name: 'Jane' },
//   { id: 3, name: 'Bob' }
// ]
```

### Stringifying Multiple Objects

```typescript
import { JsonProcessor } from 'nexurejs/native';

const jsonProcessor = new JsonProcessor();

// Array of objects to stringify
const objects = [
  { id: 1, name: 'John' },
  { id: 2, name: 'Jane' },
  { id: 3, name: 'Bob' }
];

// Stringify multiple objects (JSON Lines format)
const jsonLines = jsonProcessor.stringifyStream(objects);

console.log(jsonLines);
// '{"id":1,"name":"John"}\n{"id":2,"name":"Jane"}\n{"id":3,"name":"Bob"}'
```

## API Reference

### JsonProcessor

#### Constructor

```typescript
constructor()
```

Creates a new JsonProcessor instance.

#### Methods

##### parse(json: Buffer | string): any

Parses JSON from a Buffer or string.

- **json**: Buffer or string containing JSON data
- **Returns**: The parsed JavaScript value

##### stringify(value: any): string

Converts a JavaScript value to a JSON string.

- **value**: The JavaScript value to convert
- **Returns**: A JSON string

##### parseStream(buffer: Buffer): any[]

Parses multiple JSON objects from a Buffer (JSON Lines format).

- **buffer**: Buffer containing multiple JSON objects, one per line
- **Returns**: An array of parsed JavaScript values

##### stringifyStream(values: any[]): string

Converts an array of JavaScript values to a JSON Lines string.

- **values**: Array of JavaScript values to convert
- **Returns**: A JSON Lines string

#### Static Methods

##### getPerformanceMetrics(): object

Gets performance metrics for the JsonProcessor.

##### resetPerformanceMetrics(): void

Resets performance metrics for the JsonProcessor.

## Performance Metrics

You can get performance metrics for the JsonProcessor:

```typescript
import { JsonProcessor } from 'nexurejs/native';

// Reset metrics
JsonProcessor.resetPerformanceMetrics();

// Use the processor...
const jsonProcessor = new JsonProcessor();
jsonProcessor.parse('{"name":"John","age":30}');
jsonProcessor.stringify({ name: 'John', age: 30 });

// Get metrics
const metrics = JsonProcessor.getPerformanceMetrics();
console.log(metrics);
```

## Benchmarking

You can run benchmarks to compare the performance of the native and JavaScript implementations:

```bash
npm run benchmark:json
```

## Implementation Details

The JsonProcessor is implemented in C++ for maximum performance. It uses optimized parsing and stringification algorithms to process JSON data efficiently. The processor handles:

- All JSON data types (objects, arrays, strings, numbers, booleans, null)
- Nested structures
- Special characters and escape sequences
- Unicode characters

The JavaScript implementation provides a fallback in case the native module is not available.

## Performance Comparison

| Operation | JavaScript (ops/sec) | Native (ops/sec) | Improvement |
|-----------|----------------------|------------------|-------------|
| Parse | 200,000 | 1,200,000 | 6x |
| Stringify | 150,000 | 900,000 | 6x |

*Note: Actual performance may vary depending on your hardware and the complexity of the data being processed.*
