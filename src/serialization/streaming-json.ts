/**
 * Streaming JSON Serialization
 *
 * This module provides memory-efficient JSON serialization and deserialization for large
 * data structures. Instead of loading the entire object into memory, it processes data
 * in chunks using streams, significantly reducing memory usage for large payloads.
 */

import { Transform, Readable, Writable } from 'node:stream';
import { clearTimeout, setTimeout } from 'node:timers';

// JSON Token Types
enum JsonTokenType {
  OBJECT_START,
  OBJECT_END,
  ARRAY_START,
  ARRAY_END,
  PROPERTY,
  VALUE,
  COMMA,
  COLON
}

// JSON Token
interface JsonToken {
  type: JsonTokenType;
  value?: any;
  key?: string;
}

/**
 * JSON Serializer Stream
 *
 * Transforms JavaScript objects into a JSON string stream without
 * loading the entire object into memory.
 */
export class JsonSerializer extends Transform {
  private stack: Array<{ isArray: boolean; count: number }> = [];
  private isFirstChunk = true;
  private indentLevel = 0;
  private pretty: boolean;
  private indent: string;

  /**
   * Create a JSON serializer stream
   * @param options Options for JSON serialization
   */
  constructor(options: { pretty?: boolean; indent?: string } = {}) {
    super({ objectMode: true });
    this.pretty = options.pretty ?? false;
    this.indent = options.indent ?? '  ';
  }

  /**
   * Transform implementation
   */
  _transform(chunk: any, encoding: string, callback: (error?: Error, data?: any) => void): void {
    try {
      if (this.isFirstChunk) {
        this.isFirstChunk = false;
        this.serializeValue(chunk);
      } else {
        // If not the first chunk, we're expecting an array or object element
        if (this.stack.length > 0) {
          const top = this.stack[this.stack.length - 1];

          if (top.count > 0) {
            this.push(',');
            if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));
          }

          this.serializeValue(chunk);
          top.count++;
        } else {
          throw new Error('Cannot serialize multiple root elements');
        }
      }

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  /**
   * Flush any remaining data
   */
  _flush(callback: (error?: Error, data?: any) => void): void {
    // Close any open arrays or objects
    while (this.stack.length > 0) {
      const top = this.stack.pop()!;
      this.indentLevel--;

      if (this.pretty && top.count > 0) {
        this.push('\n' + this.indent.repeat(this.indentLevel));
      }

      this.push(top.isArray ? ']' : '}');
    }

    callback();
  }

  /**
   * Serialize a value to JSON
   */
  private serializeValue(value: any): void {
    if (value === null) {
      this.push('null');
    } else if (value === undefined) {
      this.push('null'); // JSON.stringify behavior
    } else if (typeof value === 'string') {
      this.push(JSON.stringify(value));
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      this.push(value.toString());
    } else if (Array.isArray(value)) {
      this.serializeArray(value);
    } else if (typeof value === 'object') {
      this.serializeObject(value);
    } else {
      throw new Error(`Cannot serialize value of type ${typeof value}`);
    }
  }

  /**
   * Serialize an array to JSON
   */
  private serializeArray(array: any[]): void {
    this.push('[');

    if (array.length === 0) {
      this.push(']');
      return;
    }

    this.indentLevel++;
    if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));

    this.stack.push({ isArray: true, count: 0 });

    // Serialize the first element
    this.serializeValue(array[0]);

    // Serialize remaining elements
    for (let i = 1; i < array.length; i++) {
      this.push(',');
      if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));
      this.serializeValue(array[i]);
    }

    // Close the array
    this.stack.pop();
    this.indentLevel--;

    if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));
    this.push(']');
  }

  /**
   * Serialize an object to JSON
   */
  private serializeObject(obj: Record<string, any>): void {
    this.push('{');

    const keys = Object.keys(obj);

    if (keys.length === 0) {
      this.push('}');
      return;
    }

    this.indentLevel++;
    if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));

    this.stack.push({ isArray: false, count: 0 });

    // Serialize the first key-value pair
    const firstKey = keys[0];
    this.push(JSON.stringify(firstKey));
    this.push(':');
    if (this.pretty) this.push(' ');
    this.serializeValue(obj[firstKey]);

    // Serialize remaining key-value pairs
    for (let i = 1; i < keys.length; i++) {
      const key = keys[i];
      this.push(',');
      if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));
      this.push(JSON.stringify(key));
      this.push(':');
      if (this.pretty) this.push(' ');
      this.serializeValue(obj[key]);
    }

    // Close the object
    this.stack.pop();
    this.indentLevel--;

    if (this.pretty) this.push('\n' + this.indent.repeat(this.indentLevel));
    this.push('}');
  }
}

/**
 * JSON Parser Stream
 *
 * Transforms a JSON string stream into JavaScript objects without
 * loading the entire JSON into memory.
 */
export class JsonParser extends Transform {
  private buffer = '';
  private position = 0;
  private state: 'VALUE' | 'OBJECT' | 'ARRAY' = 'VALUE';
  private stack: Array<{ isArray: boolean; current: any }> = [];
  private currentKey: string | null = null;
  private root: any = undefined;
  private complete = false;

  constructor() {
    super({ readableObjectMode: true });
  }

  /**
   * Transform implementation
   */
  _transform(chunk: Buffer | string, encoding: string, callback: (error?: Error, data?: any) => void): void {
    try {
      if (this.complete) {
        callback(new Error('Parser already completed'));
        return;
      }

      this.buffer += typeof chunk === 'string' ? chunk : chunk.toString();

      this.parse();

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  /**
   * Flush any remaining data
   */
  _flush(callback: (error?: Error, data?: any) => void): void {
    try {
      // Try to parse any remaining data
      this.parse();

      // Check if parsing is complete
      if (!this.complete) {
        callback(new Error('Unexpected end of JSON input'));
        return;
      }

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  /**
   * Parse JSON from the buffer
   */
  private parse(): void {
    while (this.position < this.buffer.length) {
      const char = this.buffer[this.position];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.position++;
        continue;
      }

      switch (this.state) {
        case 'VALUE':
          this.parseValue();
          break;
        case 'OBJECT':
          this.parseObject();
          break;
        case 'ARRAY':
          this.parseArray();
          break;
      }

      // If parsing is complete, stop
      if (this.complete) {
        break;
      }
    }

    // Clear processed data from buffer
    this.buffer = this.buffer.slice(this.position);
    this.position = 0;
  }

  /**
   * Parse a JSON value
   */
  private parseValue(): void {
    const char = this.buffer[this.position];

    switch (char) {
      case '{':
        this.startObject();
        break;
      case '[':
        this.startArray();
        break;
      case '"':
        this.parseString();
        break;
      case 't':
        this.parseTrue();
        break;
      case 'f':
        this.parseFalse();
        break;
      case 'n':
        this.parseNull();
        break;
      default:
        if (char === '-' || (char >= '0' && char <= '9')) {
          this.parseNumber();
        } else {
          throw new Error(`Unexpected character '${char}' at position ${this.position}`);
        }
    }
  }

  /**
   * Parse a JSON object
   */
  private parseObject(): void {
    const char = this.buffer[this.position];

    // Skip whitespace
    if (/\s/.test(char)) {
      this.position++;
      return;
    }

    if (char === '}') {
      // End of object
      this.endObject();
      return;
    }

    if (char === ',') {
      // Next property
      this.position++;

      // Skip whitespace
      while (this.position < this.buffer.length && /\s/.test(this.buffer[this.position])) {
        this.position++;
      }

      // Expect property name
      if (this.position < this.buffer.length && this.buffer[this.position] === '"') {
        this.parsePropertyName();
      } else {
        throw new Error(`Expected property name at position ${this.position}`);
      }
    } else if (char === '"') {
      // Property name
      this.parsePropertyName();
    } else {
      throw new Error(`Unexpected character '${char}' in object at position ${this.position}`);
    }
  }

  /**
   * Parse a JSON array
   */
  private parseArray(): void {
    const char = this.buffer[this.position];

    // Skip whitespace
    if (/\s/.test(char)) {
      this.position++;
      return;
    }

    if (char === ']') {
      // End of array
      this.endArray();
      return;
    }

    if (char === ',') {
      // Next element
      this.position++;
      this.state = 'VALUE';
    } else {
      // Element value
      this.state = 'VALUE';
    }
  }

  /**
   * Start parsing an object
   */
  private startObject(): void {
    this.position++;

    const obj = {};

    if (this.root === undefined) {
      this.root = obj;
    } else {
      this.addValueToParent(obj);
    }

    this.stack.push({ isArray: false, current: obj });
    this.state = 'OBJECT';
  }

  /**
   * End parsing an object
   */
  private endObject(): void {
    this.position++;

    const obj = this.stack.pop()!.current;

    // If this is the root object, we're done
    if (this.stack.length === 0) {
      this.complete = true;
      this.push(obj);
    }

    // Update state based on parent
    if (this.stack.length > 0) {
      this.state = this.stack[this.stack.length - 1].isArray ? 'ARRAY' : 'OBJECT';
    }
  }

  /**
   * Start parsing an array
   */
  private startArray(): void {
    this.position++;

    const arr: any[] = [];

    if (this.root === undefined) {
      this.root = arr;
    } else {
      this.addValueToParent(arr);
    }

    this.stack.push({ isArray: true, current: arr });
    this.state = 'ARRAY';
  }

  /**
   * End parsing an array
   */
  private endArray(): void {
    this.position++;

    const arr = this.stack.pop()!.current;

    // If this is the root array, we're done
    if (this.stack.length === 0) {
      this.complete = true;
      this.push(arr);
    }

    // Update state based on parent
    if (this.stack.length > 0) {
      this.state = this.stack[this.stack.length - 1].isArray ? 'ARRAY' : 'OBJECT';
    }
  }

  /**
   * Parse a property name
   */
  private parsePropertyName(): void {
    const start = this.position;
    this.position++; // Skip opening quote

    let escaped = false;

    // Find end of string
    while (this.position < this.buffer.length) {
      const char = this.buffer[this.position];

      if (char === '\\') {
        escaped = !escaped;
      } else if (char === '"' && !escaped) {
        break;
      } else {
        escaped = false;
      }

      this.position++;
    }

    if (this.position >= this.buffer.length) {
      throw new Error('Unterminated string');
    }

    // Extract property name
    const propertyName = JSON.parse(this.buffer.substring(start, this.position + 1));
    this.position++; // Skip closing quote

    // Skip whitespace
    while (this.position < this.buffer.length && /\s/.test(this.buffer[this.position])) {
      this.position++;
    }

    // Expect colon
    if (this.position < this.buffer.length && this.buffer[this.position] === ':') {
      this.position++;
      this.currentKey = propertyName;
      this.state = 'VALUE';
    } else {
      throw new Error(`Expected ':' after property name at position ${this.position}`);
    }
  }

  /**
   * Parse a string value
   */
  private parseString(): void {
    const start = this.position;
    this.position++; // Skip opening quote

    let escaped = false;

    // Find end of string
    while (this.position < this.buffer.length) {
      const char = this.buffer[this.position];

      if (char === '\\') {
        escaped = !escaped;
      } else if (char === '"' && !escaped) {
        break;
      } else {
        escaped = false;
      }

      this.position++;
    }

    if (this.position >= this.buffer.length) {
      throw new Error('Unterminated string');
    }

    // Extract string value
    const value = JSON.parse(this.buffer.substring(start, this.position + 1));
    this.position++; // Skip closing quote

    this.addValueToParent(value);
  }

  /**
   * Parse a numeric value
   */
  private parseNumber(): void {
    const start = this.position;

    // Match number pattern
    const numberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
    const match = this.buffer.slice(this.position).match(numberPattern);

    if (!match) {
      throw new Error(`Invalid number at position ${this.position}`);
    }

    const value = Number(match[0]);
    this.position += match[0].length;

    this.addValueToParent(value);
  }

  /**
   * Parse a true value
   */
  private parseTrue(): void {
    if (this.buffer.slice(this.position, this.position + 4) !== 'true') {
      throw new Error(`Expected 'true' at position ${this.position}`);
    }

    this.position += 4;
    this.addValueToParent(true);
  }

  /**
   * Parse a false value
   */
  private parseFalse(): void {
    if (this.buffer.slice(this.position, this.position + 5) !== 'false') {
      throw new Error(`Expected 'false' at position ${this.position}`);
    }

    this.position += 5;
    this.addValueToParent(false);
  }

  /**
   * Parse a null value
   */
  private parseNull(): void {
    if (this.buffer.slice(this.position, this.position + 4) !== 'null') {
      throw new Error(`Expected 'null' at position ${this.position}`);
    }

    this.position += 4;
    this.addValueToParent(null);
  }

  /**
   * Add a value to the current parent object or array
   */
  private addValueToParent(value: any): void {
    if (this.stack.length === 0) {
      // This is the root value
      this.root = value;
      this.complete = true;
      this.push(value);
      return;
    }

    const parent = this.stack[this.stack.length - 1];

    if (parent.isArray) {
      // Add to array
      (parent.current as any[]).push(value);
    } else {
      // Add to object
      if (this.currentKey === null) {
        throw new Error('Missing property name');
      }

      (parent.current as Record<string, any>)[this.currentKey] = value;
      this.currentKey = null;
    }

    // Update state based on parent
    this.state = parent.isArray ? 'ARRAY' : 'OBJECT';
  }
}

/**
 * Create a streaming JSON serializer
 * @param options Serializer options
 */
export function createJsonSerializer(options?: { pretty?: boolean; indent?: string }): Transform {
  return new JsonSerializer(options);
}

/**
 * Create a streaming JSON parser
 */
export function createJsonParser(): Transform {
  return new JsonParser();
}

/**
 * Serialize an object to JSON with streaming
 * @param value Value to serialize
 * @param options Serializer options
 */
export function stringifyStream(value: any, options?: { pretty?: boolean; indent?: string }): Readable {
  const serializer = createJsonSerializer(options);

  // Create a readable stream that pushes the value and ends
  const source = new Readable({
    objectMode: true,
    read() {
      this.push(value);
      this.push(null);
    }
  });

  return source.pipe(serializer);
}

/**
 * Parse JSON from a stream
 * @param source JSON source stream
 * @param timeout Optional timeout in milliseconds
 */
export function parseStream(source: Readable, timeout?: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;

    if (timeout) {
      timer = setTimeout(() => {
        reject(new Error(`JSON parsing timed out after ${timeout}ms`));

        // Force end the pipe
        parser.end();
      }, timeout);
    }

    const parser = createJsonParser();
    const results: any[] = [];

    parser.on('data', (data) => {
      results.push(data);
    });

    parser.on('end', () => {
      if (timer) clearTimeout(timer);

      if (results.length === 0) {
        reject(new Error('No JSON data found'));
      } else if (results.length === 1) {
        resolve(results[0]);
      } else {
        resolve(results);
      }
    });

    parser.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    source.pipe(parser);
  });
}
