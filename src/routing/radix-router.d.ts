/**
 * Type definitions for the RadixRouter
 */

export class RadixRouter {
  constructor(prefix?: string);

  // Add methods for route registration
  register(method: string, path: string, handler: Function): void;
  addRoute(method: string, path: string, handler: Function): void;

  // Add methods for route matching
  match(method: string, path: string): any;
  find(method: string, path: string): any;
}
