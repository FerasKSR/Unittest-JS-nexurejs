/**
 * Validation Middleware
 *
 * This implementation provides comprehensive input validation with:
 * - Support for validating all request components (body, query, params, headers, cookies)
 * - Nested object validation
 * - Advanced sanitization
 * - Custom error messages
 * - Context-aware validation
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { MiddlewareHandler } from '../middleware/middleware';
import { Validator, ValidationSchema } from './validator';
import { HttpException } from '../http/http-exception';

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

  /**
   * Custom error messages
   */
  messages?: Record<string, string>;

  /**
   * Whether to strip unknown properties
   * @default false
   */
  stripUnknown?: boolean;

  /**
   * Whether to allow unknown properties
   * @default true
   */
  allowUnknown?: boolean;

  /**
   * Path prefix for error messages
   */
  pathPrefix?: string;
}

/**
 * Request validation schema
 */
export interface RequestValidationSchema {
  /**
   * Body validation schema
   */
  body?: ValidationSchema;

  /**
   * Query validation schema
   */
  query?: ValidationSchema;

  /**
   * Params validation schema
   */
  params?: ValidationSchema;

  /**
   * Headers validation schema
   */
  headers?: ValidationSchema;

  /**
   * Cookies validation schema
   */
  cookies?: ValidationSchema;
}

/**
 * Combined validation result for a request
 */
export interface RequestValidationResult {
  /**
   * Whether validation passed for all parts
   */
  valid: boolean;

  /**
   * Errors grouped by request part
   */
  errors: {
    body?: any[];
    query?: any[];
    params?: any[];
    headers?: any[];
    cookies?: any[];
  };

  /**
   * Sanitized data grouped by request part
   */
  data: {
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
    cookies?: any;
  };
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
  const stripUnknown = options.stripUnknown || false;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Skip validation for methods that don't have a body
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return next();
    }

    // Get request body
    const body = (req as any).body || {};

    // Validate body
    const result = await validator.validate(body, schema, {
      stripUnknown,
      allowUnknown,
      pathPrefix: options.pathPrefix
    });

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
  const stripUnknown = options.stripUnknown || false;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Get query parameters
    const query = (req as any).query || {};

    // Validate query
    const result = await validator.validate(query, schema, {
      stripUnknown,
      allowUnknown,
      pathPrefix: options.pathPrefix
    });

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
  const stripUnknown = options.stripUnknown || false;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Get parameters
    const params = (req as any).params || {};

    // Validate parameters
    const result = await validator.validate(params, schema, {
      stripUnknown,
      allowUnknown,
      pathPrefix: options.pathPrefix
    });

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

/**
 * Create a validation middleware for request headers
 * @param schema The validation schema
 * @param options Validation options
 */
export function validateHeaders(
  schema: ValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Get headers
    const headers = req.headers;

    // Validate headers
    const result = await validator.validate(headers, schema, {
      stripUnknown: false,
      allowUnknown,
      pathPrefix: options.pathPrefix
    });

    // Store validation result
    (req as any).headersValidationResult = result;

    // Update headers with sanitized data if enabled - only for safe headers
    if (sanitize && result.valid) {
      const safeHeaders = { ...result.data };
      // Don't replace the original headers object, just update safe headers
      for (const [key, value] of Object.entries(safeHeaders)) {
        if (!key.match(/^(host|connection|content-length|cookie|authorization)$/i)) {
          req.headers[key] = value as string;
        }
      }
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Header validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}

/**
 * Create a validation middleware for request cookies
 * @param schema The validation schema
 * @param options Validation options
 */
export function validateCookies(
  schema: ValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;
  const stripUnknown = options.stripUnknown || false;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Get cookies
    const cookies = (req as any).cookies || {};

    // Validate cookies
    const result = await validator.validate(cookies, schema, {
      stripUnknown,
      allowUnknown,
      pathPrefix: options.pathPrefix
    });

    // Store validation result
    (req as any).cookiesValidationResult = result;

    // Update cookies with sanitized data if enabled
    if (sanitize && result.valid) {
      (req as any).cookies = result.data;
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Cookie validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}

/**
 * Create a comprehensive validation middleware for all request components
 * @param schema The request validation schema
 * @param options Validation options
 */
export function validateRequest(
  schema: RequestValidationSchema,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const validator = new Validator();
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;
  const stripUnknown = options.stripUnknown || false;
  const allowUnknown = options.allowUnknown !== false;

  // Register custom messages if provided
  if (options.messages) {
    for (const [key, message] of Object.entries(options.messages)) {
      validator.registerMessage(key, message);
    }
  }

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    const validationResult: RequestValidationResult = {
      valid: true,
      errors: {},
      data: {}
    };

    // Validate each component
    if (schema.body && !['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      await validateRequestBody(req, schema.body, validationResult, validator, {
        stripUnknown,
        allowUnknown,
        sanitize,
        pathPrefix: options.pathPrefix
      });
    }

    if (schema.query) {
      await validateRequestQuery(req, schema.query, validationResult, validator, {
        stripUnknown,
        allowUnknown,
        sanitize,
        pathPrefix: options.pathPrefix
      });
    }

    if (schema.params) {
      await validateRequestParams(req, schema.params, validationResult, validator, {
        stripUnknown,
        allowUnknown,
        sanitize,
        pathPrefix: options.pathPrefix
      });
    }

    if (schema.headers) {
      await validateRequestHeaders(req, schema.headers, validationResult, validator, {
        sanitize,
        pathPrefix: options.pathPrefix
      });
    }

    if (schema.cookies) {
      await validateRequestCookies(req, schema.cookies, validationResult, validator, {
        stripUnknown,
        allowUnknown,
        sanitize,
        pathPrefix: options.pathPrefix
      });
    }

    // Store combined validation result
    (req as any).requestValidationResult = validationResult;

    // Abort if validation failed and abortOnFailure is enabled
    if (!validationResult.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Request validation failed', {
        errors: validationResult.errors
      });
    }

    await next();
  };
}

/**
 * Helper method to validate request body
 */
async function validateRequestBody(
  req: IncomingMessage,
  schema: ValidationSchema,
  validationResult: RequestValidationResult,
  validator: Validator,
  options: {
    stripUnknown: boolean;
    allowUnknown: boolean;
    sanitize: boolean;
    pathPrefix?: string;
  }
): Promise<void> {
  const { stripUnknown, allowUnknown, sanitize, pathPrefix } = options;
  const body = (req as any).body || {};

  const result = await validator.validate(body, schema, {
    stripUnknown,
    allowUnknown,
    pathPrefix: pathPrefix ? `${pathPrefix}.body` : 'body'
  });

  if (!result.valid) {
    validationResult.valid = false;
    validationResult.errors.body = result.errors;
  }

  validationResult.data.body = result.data;

  // Update body with sanitized data if enabled
  if (sanitize && result.valid) {
    (req as any).body = result.data;
  }
}

/**
 * Helper method to validate request query
 */
async function validateRequestQuery(
  req: IncomingMessage,
  schema: ValidationSchema,
  validationResult: RequestValidationResult,
  validator: Validator,
  options: {
    stripUnknown: boolean;
    allowUnknown: boolean;
    sanitize: boolean;
    pathPrefix?: string;
  }
): Promise<void> {
  const { stripUnknown, allowUnknown, sanitize, pathPrefix } = options;
  const query = (req as any).query || {};

  const result = await validator.validate(query, schema, {
    stripUnknown,
    allowUnknown,
    pathPrefix: pathPrefix ? `${pathPrefix}.query` : 'query'
  });

  if (!result.valid) {
    validationResult.valid = false;
    validationResult.errors.query = result.errors;
  }

  validationResult.data.query = result.data;

  // Update query with sanitized data if enabled
  if (sanitize && result.valid) {
    (req as any).query = result.data;
  }
}

/**
 * Helper method to validate request params
 */
async function validateRequestParams(
  req: IncomingMessage,
  schema: ValidationSchema,
  validationResult: RequestValidationResult,
  validator: Validator,
  options: {
    stripUnknown: boolean;
    allowUnknown: boolean;
    sanitize: boolean;
    pathPrefix?: string;
  }
): Promise<void> {
  const { stripUnknown, allowUnknown, sanitize, pathPrefix } = options;
  const params = (req as any).params || {};

  const result = await validator.validate(params, schema, {
    stripUnknown,
    allowUnknown,
    pathPrefix: pathPrefix ? `${pathPrefix}.params` : 'params'
  });

  if (!result.valid) {
    validationResult.valid = false;
    validationResult.errors.params = result.errors;
  }

  validationResult.data.params = result.data;

  // Update params with sanitized data if enabled
  if (sanitize && result.valid) {
    (req as any).params = result.data;
  }
}

/**
 * Helper method to validate request headers
 */
async function validateRequestHeaders(
  req: IncomingMessage,
  schema: ValidationSchema,
  validationResult: RequestValidationResult,
  validator: Validator,
  options: {
    sanitize: boolean;
    pathPrefix?: string;
  }
): Promise<void> {
  const { sanitize, pathPrefix } = options;
  const headers = req.headers;

  const result = await validator.validate(headers, schema, {
    stripUnknown: false, // Never strip unknown headers
    allowUnknown: true, // Always allow unknown headers
    pathPrefix: pathPrefix ? `${pathPrefix}.headers` : 'headers'
  });

  if (!result.valid) {
    validationResult.valid = false;
    validationResult.errors.headers = result.errors;
  }

  validationResult.data.headers = result.data;

  // Sanitize headers is handled specially - only update safe headers
  if (sanitize && result.valid) {
    const safeHeaders = { ...result.data };
    // Don't replace the original headers object, just update safe headers
    for (const [key, value] of Object.entries(safeHeaders)) {
      if (!key.match(/^(host|connection|content-length|cookie|authorization)$/i)) {
        req.headers[key] = value as string;
      }
    }
  }
}

/**
 * Helper method to validate request cookies
 */
async function validateRequestCookies(
  req: IncomingMessage,
  schema: ValidationSchema,
  validationResult: RequestValidationResult,
  validator: Validator,
  options: {
    stripUnknown: boolean;
    allowUnknown: boolean;
    sanitize: boolean;
    pathPrefix?: string;
  }
): Promise<void> {
  const { stripUnknown, allowUnknown, sanitize, pathPrefix } = options;
  const cookies = (req as any).cookies || {};

  const result = await validator.validate(cookies, schema, {
    stripUnknown,
    allowUnknown,
    pathPrefix: pathPrefix ? `${pathPrefix}.cookies` : 'cookies'
  });

  if (!result.valid) {
    validationResult.valid = false;
    validationResult.errors.cookies = result.errors;
  }

  validationResult.data.cookies = result.data;

  // Update cookies with sanitized data if enabled
  if (sanitize && result.valid) {
    (req as any).cookies = result.data;
  }
}

/**
 * Create a custom validation middleware
 * @param validator Custom validator function
 * @param options Validation options
 */
export function validateCustom(
  validator: (req: IncomingMessage) => Promise<{ valid: boolean; errors?: any[]; data?: any }>,
  options: ValidationOptions = {}
): MiddlewareHandler {
  const abortOnFailure = options.abortOnFailure !== false;
  const sanitize = options.sanitize !== false;
  const statusCode = options.statusCode || 400;

  return async (req: IncomingMessage, _res: ServerResponse, next: () => Promise<void>) => {
    // Run custom validator
    const result = await validator(req);

    // Store validation result
    (req as any).customValidationResult = result;

    // Update request with sanitized data if enabled
    if (sanitize && result.valid && result.data) {
      Object.assign(req, result.data);
    }

    // Abort if validation failed and abortOnFailure is enabled
    if (!result.valid && abortOnFailure) {
      throw new HttpException(statusCode, 'Custom validation failed', {
        errors: result.errors
      });
    }

    await next();
  };
}
