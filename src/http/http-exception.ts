/**
 * HTTP exception class for handling HTTP errors
 */
export class HttpException extends Error {
  /**
   * HTTP status code
   */
  readonly statusCode: number;

  /**
   * Additional error details
   */
  readonly details?: any;

  /**
   * Create a new HTTP exception
   * @param statusCode HTTP status code
   * @param message Error message
   * @param details Additional error details
   */
  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'HttpException';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request exception
   * @param message Error message
   * @param details Additional error details
   */
  static badRequest(message: string = 'Bad Request', details?: any): HttpException {
    return new HttpException(400, message, details);
  }

  /**
   * Create a 401 Unauthorized exception
   * @param message Error message
   * @param details Additional error details
   */
  static unauthorized(message: string = 'Unauthorized', details?: any): HttpException {
    return new HttpException(401, message, details);
  }

  /**
   * Create a 403 Forbidden exception
   * @param message Error message
   * @param details Additional error details
   */
  static forbidden(message: string = 'Forbidden', details?: any): HttpException {
    return new HttpException(403, message, details);
  }

  /**
   * Create a 404 Not Found exception
   * @param message Error message
   * @param details Additional error details
   */
  static notFound(message: string = 'Not Found', details?: any): HttpException {
    return new HttpException(404, message, details);
  }

  /**
   * Create a 409 Conflict exception
   * @param message Error message
   * @param details Additional error details
   */
  static conflict(message: string = 'Conflict', details?: any): HttpException {
    return new HttpException(409, message, details);
  }

  /**
   * Create a 500 Internal Server Error exception
   * @param message Error message
   * @param details Additional error details
   */
  static internal(message: string = 'Internal Server Error', details?: any): HttpException {
    return new HttpException(500, message, details);
  }
}
