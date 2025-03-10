/**
 * Type definitions for native module components
 */

import { Buffer } from 'node:buffer';

/**
 * HTTP parse result from native parser
 */
export interface HttpParseResult {
  method: string;
  url: string;
  versionMajor: number;
  versionMinor: number;
  headers: Record<string, string>;
  body: Buffer | null;
  complete: boolean;
  upgrade: boolean;
  statusCode?: number;
  statusMessage?: string;
}

/**
 * Native HTTP parser interface
 */
export interface NativeHttpParser {
  parse(buffer: Buffer): HttpParseResult;
  parseHeaders(buffer: Buffer): Record<string, string>;
  parseBody(buffer: Buffer, contentLength: number): Buffer;
  reset(): void;
}

/**
 * Native radix router interface
 */
export interface NativeRadixRouter {
  add(method: string, path: string, handler: any): void;
  find(method: string, path: string): { handler: any; params: Record<string, string>; found: boolean };
  remove(method: string, path: string): boolean;
}

/**
 * Native JSON processor interface
 */
export interface NativeJsonProcessor {
  parse(json: string | Buffer): any;
  stringify(value: any): string;
  parseStream(buffer: Buffer): any[];
  stringifyStream(values: any[]): string;
}
