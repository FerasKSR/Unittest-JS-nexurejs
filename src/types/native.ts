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
  parse(_buffer: Buffer): HttpParseResult;
  parseHeaders(_buffer: Buffer): Record<string, string>;
  parseBody(_buffer: Buffer, _contentLength: number): Buffer;
  reset(): void;
}

/**
 * Object Pool options
 */
export interface ObjectPoolOptions {
  /**
   * Maximum size of the object pool
   * @default 1000
   */
  maxObjectPoolSize?: number;

  /**
   * Maximum size of the buffer pool
   * @default 1000
   */
  maxBufferPoolSize?: number;

  /**
   * Maximum size of the headers pool
   * @default 1000
   */
  maxHeadersPoolSize?: number;

  /**
   * Whether to enable the pool
   * @default true
   */
  enabled?: boolean;
}

/**
 * Pool information
 */
export interface PoolInfo {
  enabled: boolean;
  objects: {
    total: number;
    inUse: number;
    available: number;
    maxSize: number;
  };
  buffers: {
    total: number;
    inUse: number;
    available: number;
    maxSize: number;
  };
  headers: {
    total: number;
    inUse: number;
    available: number;
    maxSize: number;
  };
}

/**
 * Native Object Pool interface
 */
export interface NativeObjectPool {
  createObject(): object;
  releaseObject(_obj: object): void;
  getHeadersObject(): object;
  releaseHeadersObject(_headers: object): void;
  getBuffer(_size: number): Buffer;
  releaseBuffer(_buffer: Buffer): void;
  reset(): void;
  getPoolInfo(): PoolInfo;
}

/**
 * Native radix router interface
 */
export interface NativeRadixRouter {
  add(_method: string, _path: string, _handler: any): void;
  find(_method: string, _path: string): { handler: any; params: Record<string, string>; found: boolean };
  remove(_method: string, _path: string): boolean;
}

/**
 * Native JSON processor interface
 */
export interface NativeJsonProcessor {
  parse(_json: string | Buffer): any;
  stringify(_value: any): string;
  parseStream(_buffer: Buffer): any[];
  stringifyStream(_values: any[]): string;
}
