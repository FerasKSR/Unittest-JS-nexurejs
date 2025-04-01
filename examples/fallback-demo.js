/**
 * NexureJS Fallback Demo
 *
 * This example demonstrates the automatic fallback to JavaScript implementation
 * when native modules are unavailable or when forced via command line flags.
 *
 * Run with: node examples/fallback-demo.js
 * Force JS: node examples/fallback-demo.js --force-js
 * Verbose:  node examples/fallback-demo.js --verbose
 *
 * For complete API documentation, see:
 * - API Reference: ./docs/API_REFERENCE.md
 * - Examples Guide: ./docs/EXAMPLES.md
 */

const nexure = require('../dist/index.js');

console.log('NexureJS Fallback Demo');
console.log('=====================');
console.log(`Using native implementation: ${nexure.isNative ? 'Yes' : 'No'}`);
console.log(`Version: ${nexure.version}`);
console.log('');

// Try a few API calls to demonstrate functionality

// 1. HTTP Parser
console.log('HTTP Parser Demo:');
const parser = new nexure.HttpParser();
const result = parser.parse('GET /hello HTTP/1.1\r\nHost: example.com\r\nContent-Type: text/plain\r\n\r\nHello, World!');
console.log(JSON.stringify(result, null, 2));
console.log('');

// 2. Object Pool
console.log('Object Pool Demo:');
const pool = new nexure.ObjectPool({ maxSize: 10 });
const obj1 = pool.get('test', () => ({ id: 1, value: 'Hello' }));
pool.release('test', obj1);
const obj2 = pool.get('test', () => ({ id: 2, value: 'World' }));
console.log('Object from pool:', obj2);
console.log('Pool stats:', pool.getStats());
console.log('');

// 3. Schema Validation
console.log('Schema Validation Demo:');
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  }
};

const validData = { name: 'John', age: 30 };
const invalidData = { name: 'Jane', age: 'twenty' };

console.log('Valid data validation result:', nexure.validate(schema, validData));
console.log('Invalid data validation result:', nexure.validate(schema, invalidData));
console.log('');

// 4. URL Parsing
console.log('URL Parsing Demo:');
const url = nexure.parseUrl('https://example.com/path?query=value#fragment');
console.log('Parsed URL:', url);
console.log('Query string:', nexure.parseQueryString('user=john&role=admin'));
console.log('');

// Try switching implementations if possible
if (!nexure.isNative && nexure.forceNativeImplementation()) {
  console.log('Successfully switched to native implementation!');
  console.log(`Now using: ${nexure.isNative ? 'Native' : 'JavaScript'}`);
} else if (nexure.isNative) {
  console.log('Testing JavaScript fallback...');
  nexure.forceJavaScriptFallback();
  console.log(`Now using: ${nexure.isNative ? 'Native' : 'JavaScript'}`);
}

console.log('\nDemo completed.')
