/**
 * Type definitions for the ZeroCopyHttpParser
 */

export class ZeroCopyHttpParser {
  constructor();

  parse(buffer: Buffer): any;

  // Add a public clear method that can be used instead of the private reset method
  clear(): void;
}
