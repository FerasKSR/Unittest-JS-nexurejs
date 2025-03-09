import { IncomingMessage } from 'node:http';
import { HttpException } from './http-exception.js';

/**
 * Parse the request body
 * @param req The incoming request
 */
export async function parseBody(req: IncomingMessage): Promise<any> {
  // Skip body parsing for methods that don't have a body
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return {};
  }

  // Check content type
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    return parseJson(req);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    return parseUrlEncoded(req);
  } else if (contentType.includes('multipart/form-data')) {
    return parseMultipart(req);
  } else if (contentType.includes('text/plain')) {
    return parseText(req);
  }

  // Default to raw body
  return parseRaw(req);
}

/**
 * Parse JSON request body
 * @param req The incoming request
 */
async function parseJson(req: IncomingMessage): Promise<any> {
  try {
    const raw = await parseRaw(req);
    return JSON.parse(raw.toString());
  } catch (error) {
    throw HttpException.badRequest('Invalid JSON body');
  }
}

/**
 * Parse URL-encoded request body
 * @param req The incoming request
 */
async function parseUrlEncoded(req: IncomingMessage): Promise<Record<string, string>> {
  try {
    const raw = await parseRaw(req);
    const text = raw.toString();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      result[key] = value;
    }

    return result;
  } catch (error) {
    throw HttpException.badRequest('Invalid URL-encoded body');
  }
}

/**
 * Parse multipart form data request body
 * @param req The incoming request
 */
async function parseMultipart(req: IncomingMessage): Promise<any> {
  // This is a simplified implementation
  // In a real-world scenario, you would use a library like formidable or busboy
  // or implement a more robust multipart parser

  // For now, just return the raw body
  const raw = await parseRaw(req);
  return { _raw: raw };
}

/**
 * Parse text request body
 * @param req The incoming request
 */
async function parseText(req: IncomingMessage): Promise<string> {
  const raw = await parseRaw(req);
  return raw.toString();
}

/**
 * Parse raw request body
 * @param req The incoming request
 */
async function parseRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      reject(HttpException.badRequest('Error parsing request body'));
    });
  });
}
