import { Buffer } from 'node:buffer';

// Common HTTP header names as buffers for zero-copy comparison
export const HTTP_HEADERS = {
  CONTENT_LENGTH: Buffer.from('content-length'),
  CONTENT_TYPE: Buffer.from('content-type'),
  CONNECTION: Buffer.from('connection'),
  TRANSFER_ENCODING: Buffer.from('transfer-encoding'),
  HOST: Buffer.from('host'),
  ACCEPT: Buffer.from('accept'),
  USER_AGENT: Buffer.from('user-agent'),
  COOKIE: Buffer.from('cookie'),
  AUTHORIZATION: Buffer.from('authorization'),
  ACCEPT_ENCODING: Buffer.from('accept-encoding'),
  ACCEPT_LANGUAGE: Buffer.from('accept-language'),
  CACHE_CONTROL: Buffer.from('cache-control'),
  ORIGIN: Buffer.from('origin'),
  REFERER: Buffer.from('referer'),
  IF_NONE_MATCH: Buffer.from('if-none-match'),
  IF_MODIFIED_SINCE: Buffer.from('if-modified-since'),
  X_REQUESTED_WITH: Buffer.from('x-requested-with'),
  X_FORWARDED_FOR: Buffer.from('x-forwarded-for'),
  X_FORWARDED_PROTO: Buffer.from('x-forwarded-proto'),
  X_FORWARDED_HOST: Buffer.from('x-forwarded-host')
} as const;

// Common HTTP methods as buffers
export const HTTP_METHODS = {
  GET: Buffer.from('GET'),
  POST: Buffer.from('POST'),
  PUT: Buffer.from('PUT'),
  DELETE: Buffer.from('DELETE'),
  HEAD: Buffer.from('HEAD'),
  OPTIONS: Buffer.from('OPTIONS'),
  PATCH: Buffer.from('PATCH')
} as const;

/**
 * HTTP Constants
 */

export const HTTP_CONSTANTS = {
  CRLF: Buffer.from('\r\n'),
  DOUBLE_CRLF: Buffer.from('\r\n\r\n'),
  SPACE: Buffer.from(' '),
  COLON_SPACE: Buffer.from(': '),
  toString(): typeof HTTP_CONSTANTS {
    return this;
  }
};

export const HTTP_LIMITS = {
  MAX_HEADER_SIZE: 8192
};

// HTTP status codes
export const HTTP_STATUS = {
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  REQUEST_ENTITY_TOO_LARGE: 413,
  REQUEST_URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505
} as const;

// HTTP status messages
export const HTTP_STATUS_MESSAGES = {
  [HTTP_STATUS.CONTINUE]: 'Continue',
  [HTTP_STATUS.SWITCHING_PROTOCOLS]: 'Switching Protocols',
  [HTTP_STATUS.OK]: 'OK',
  [HTTP_STATUS.CREATED]: 'Created',
  [HTTP_STATUS.ACCEPTED]: 'Accepted',
  [HTTP_STATUS.NO_CONTENT]: 'No Content',
  [HTTP_STATUS.MOVED_PERMANENTLY]: 'Moved Permanently',
  [HTTP_STATUS.FOUND]: 'Found',
  [HTTP_STATUS.NOT_MODIFIED]: 'Not Modified',
  [HTTP_STATUS.BAD_REQUEST]: 'Bad Request',
  [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
  [HTTP_STATUS.FORBIDDEN]: 'Forbidden',
  [HTTP_STATUS.NOT_FOUND]: 'Not Found',
  [HTTP_STATUS.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HTTP_STATUS.REQUEST_TIMEOUT]: 'Request Timeout',
  [HTTP_STATUS.CONFLICT]: 'Conflict',
  [HTTP_STATUS.GONE]: 'Gone',
  [HTTP_STATUS.LENGTH_REQUIRED]: 'Length Required',
  [HTTP_STATUS.PRECONDITION_FAILED]: 'Precondition Failed',
  [HTTP_STATUS.REQUEST_ENTITY_TOO_LARGE]: 'Request Entity Too Large',
  [HTTP_STATUS.REQUEST_URI_TOO_LONG]: 'Request-URI Too Long',
  [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HTTP_STATUS.NOT_IMPLEMENTED]: 'Not Implemented',
  [HTTP_STATUS.BAD_GATEWAY]: 'Bad Gateway',
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HTTP_STATUS.GATEWAY_TIMEOUT]: 'Gateway Timeout',
  [HTTP_STATUS.HTTP_VERSION_NOT_SUPPORTED]: 'HTTP Version Not Supported'
} as const;
