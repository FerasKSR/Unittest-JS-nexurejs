# NexureJS Examples

This directory contains practical examples demonstrating how to use NexureJS in real-world scenarios.

**For detailed documentation on all examples, please see:**
[NexureJS Examples Guide](../docs/EXAMPLES.md)

## Structure

The examples are organized into the following categories:

- **Basics**: Simple examples for getting started
- **API Development**: Examples showing how to build RESTful APIs
- **Performance**: Demonstrations of performance optimizations
- **Security**: Security best practices and implementations
- **Advanced Features**: Examples showcasing more complex features
- **Real-world Use Cases**: Complete application examples

## Running the Examples

Unless otherwise specified in the example's own README, you can run any example using:

```bash
# From the root directory of the project:
node examples/[path-to-example]/[example-file].js
```

For TypeScript examples:

```bash
# First compile the TypeScript code
npm run build

# Then run the compiled JavaScript
node dist/examples/[path-to-example]/[example-file].js
```

## Quick Reference

### Basic Examples

- **Simple Server**: A minimal HTTP server with basic routing (`basic/simple-server.js`)
- **Middleware Usage**: How to use middleware in NexureJS (`basic/middleware-basics.js`)

### API Development Examples

- **Input Validation**: Validating request inputs using built-in validators (`api/input-validation.js`)

### Performance Examples

- **Streaming**: Efficiently handling large files with streams (`performance/streaming.js`)

## API Reference Documentation

For complete API documentation, see:
[NexureJS API Reference](../docs/API_REFERENCE.md)

## Contribution

Feel free to contribute your own examples by submitting a pull request!
