/**
 * Validation middleware
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { MiddlewareHandler } from '../middleware/middleware.js';
import { Validator, ValidationSchema } from './validator.js';
import { HttpException } from '../http/http-exception.js';

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Whether to abort on validation failure
   * @default true
   */
  abortOnFailure?: boolean;

  /**
   * Whether to sanitize data
   * @default true
   */
  sanitize?: boolean;

  /**
   * Status code to use for validation errors
   * @default 400
   */
  statusCode?: number;
}

/**
 * Create a validation middleware for request body
 * @param schema The validation schema
 * @param options Validation options
 */
export function validateBody(
  schema: ValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Skip validation for methods that don't have a body
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return next();
    }

    // Get request body
    const body = (req as any).body || {};

    // Validate body
    const result = await validator.validate(body, schema);

    // Store validation result
    (req as any).validationResult = result;

    // Update body with sanitized data if enabled
    if (sanitize && result.valid) {
      (req as any).body = result.data;
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}

/**
 * Create a validation middleware for request query parameters
 * @param schema The validation schema
 * @param options Validation options
 */
export function validateQuery(
  schema: ValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Get query parameters
    const query = (req as any).query || {};

    // Validate query
    const result = await validator.validate(query, schema);

    // Store validation result
    (req as any).queryValidationResult = result;

    // Update query with sanitized data if enabled
    if (sanitize && result.valid) {
      (req as any).query = result.data;
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Query validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}

/**
 * Create a validation middleware for request parameters
 * @param schema The validation schema
 * @param options Validation options
 */
export function validateParams(
  schema: ValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Get parameters
    const params = (req as any).params || {};

    // Validate parameters
    const result = await validator.validate(params, schema);

    // Store validation result
    (req as any).paramsValidationResult = result;

    // Update parameters with sanitized data if enabled
    if (sanitize && result.valid) {
      (req as any).params = result.data;
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Parameter validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}
