/**
 * Simplified Validation Middleware
 *
 * This implementation provides basic input validation with:
 * - Support for validating request body
 * - Error handling
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Validator, ValidationSchema } from './validator.js';
import { HttpException } from '../http/http-exception.js';
import { MiddlewareHandler } from '../middleware/middleware.js';

/**
 * Validation options
 */
export interface SimpleValidationOptions {
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
  options: SimpleValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Skip validation for methods that don't have a body
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return next();
    }

    // Get request body
    const body = (req as any).body || {};

    // Validate body using simplified schema
    const simpleSchema = {
      ...schema,
      path: 'body'
    };

    const result = validator.validate(body, simpleSchema);

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
