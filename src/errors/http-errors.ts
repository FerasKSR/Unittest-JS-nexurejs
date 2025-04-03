/**
 * HTTP Error Classes
 *
 * A set of standardized HTTP error classes that extend the built-in Error class.
 * These classes make it easier to handle HTTP errors in a consistent way
 * across the application.
 */

/**
 * Base HTTP Error class
 */
export class HttpError extends Error {
  /**
   * HTTP status code
   */
  public statusCode: number;

  /**
   * Error code for programmatic identification
   */
  public code: string;

  /**
   * Additional error details
   */
  public details?: any;

  /**
   * Time when the error occurred
   */
  public timestamp: Date;

  /**
   * Create a new HTTP error
   * @param message Error message
   * @param statusCode HTTP status code
   * @param code Error code
   * @param details Additional error details
   */
  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert the error to a JSON object
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: this.timestamp.toISOString(),
        details: this.details
      }
    };
  }

  /**
   * Get error headers
   */
  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details?: any) {
    super(message, 400, code, details);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: any) {
    super(message, 401, code, details);
  }

  override getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
      'WWW-Authenticate': 'Bearer'
    };
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: any) {
    super(message, 403, code, details);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', code = 'NOT_FOUND', details?: any) {
    super(message, 404, code, details);
  }
}

/**
 * 405 Method Not Allowed
 */
export class MethodNotAllowedError extends HttpError {
  constructor(
    message = 'Method Not Allowed',
    code = 'METHOD_NOT_ALLOWED',
    details?: any,
    private allowedMethods: string[] = []
  ) {
    super(message, 405, code, details);
  }

  override getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
      Allow: this.allowedMethods.join(', ')
    };
  }
}

/**
 * 406 Not Acceptable
 */
export class NotAcceptableError extends HttpError {
  constructor(message = 'Not Acceptable', code = 'NOT_ACCEPTABLE', details?: any) {
    super(message, 406, code, details);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends HttpError {
  constructor(message = 'Conflict', code = 'CONFLICT', details?: any) {
    super(message, 409, code, details);
  }
}

/**
 * 413 Payload Too Large
 */
export class PayloadTooLargeError extends HttpError {
  constructor(message = 'Payload Too Large', code = 'PAYLOAD_TOO_LARGE', details?: any) {
    super(message, 413, code, details);
  }
}

/**
 * 415 Unsupported Media Type
 */
export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported Media Type', code = 'UNSUPPORTED_MEDIA_TYPE', details?: any) {
    super(message, 415, code, details);
  }
}

/**
 * 422 Unprocessable Entity
 */
export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', code = 'UNPROCESSABLE_ENTITY', details?: any) {
    super(message, 422, code, details);
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends HttpError {
  constructor(
    message = 'Too Many Requests',
    code = 'TOO_MANY_REQUESTS',
    details?: any,
    private retryAfter?: number
  ) {
    super(message, 429, code, details);
  }

  override getHeaders(): Record<string, string> {
    const headers = super.getHeaders();

    if (this.retryAfter !== undefined) {
      headers['Retry-After'] = String(this.retryAfter);
    }

    return headers;
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message, 500, code, details);
  }
}

/**
 * 501 Not Implemented
 */
export class NotImplementedError extends HttpError {
  constructor(message = 'Not Implemented', code = 'NOT_IMPLEMENTED', details?: any) {
    super(message, 501, code, details);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends HttpError {
  constructor(
    message = 'Service Unavailable',
    code = 'SERVICE_UNAVAILABLE',
    details?: any,
    private retryAfter?: number
  ) {
    super(message, 503, code, details);
  }

  override getHeaders(): Record<string, string> {
    const headers = super.getHeaders();

    if (this.retryAfter !== undefined) {
      headers['Retry-After'] = String(this.retryAfter);
    }

    return headers;
  }
}

/**
 * Create an HTTP error from status code
 * @param statusCode HTTP status code
 * @param message Error message
 * @param code Error code
 * @param details Additional error details
 */
export function createHttpError(
  statusCode: number,
  message?: string,
  code?: string,
  details?: any
): HttpError {
  switch (statusCode) {
    case 400:
      return new BadRequestError(message, code, details);
    case 401:
      return new UnauthorizedError(message, code, details);
    case 403:
      return new ForbiddenError(message, code, details);
    case 404:
      return new NotFoundError(message, code, details);
    case 405:
      return new MethodNotAllowedError(message, code, details);
    case 406:
      return new NotAcceptableError(message, code, details);
    case 409:
      return new ConflictError(message, code, details);
    case 413:
      return new PayloadTooLargeError(message, code, details);
    case 415:
      return new UnsupportedMediaTypeError(message, code, details);
    case 422:
      return new UnprocessableEntityError(message, code, details);
    case 429:
      return new TooManyRequestsError(message, code, details);
    case 500:
      return new InternalServerError(message, code, details);
    case 501:
      return new NotImplementedError(message, code, details);
    case 503:
      return new ServiceUnavailableError(message, code, details);
    default:
      return new HttpError(
        message || `HTTP Error ${statusCode}`,
        statusCode,
        code || 'HTTP_ERROR',
        details
      );
  }
}

/**
 * Check if an error is an HTTP error
 * @param error Error to check
 */
export function isHttpError(error: any): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Convert any error to an HTTP error
 * @param error Error to convert
 * @param defaultStatus Default status code
 */
export function toHttpError(error: any, defaultStatus = 500): HttpError {
  if (isHttpError(error)) {
    return error;
  }

  // Extract status from error if available
  const status = error.statusCode || error.status || defaultStatus;
  const message = error.message || 'Unknown error';
  const code = error.code || `HTTP_${status}`;

  return createHttpError(status, message, code, error.details);
}

export default {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  NotAcceptableError,
  ConflictError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  NotImplementedError,
  ServiceUnavailableError,
  createHttpError,
  isHttpError,
  toHttpError
};
