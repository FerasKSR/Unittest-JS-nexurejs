/**
 * File Utilities
 *
 * Efficient file handling utilities optimized for performance
 * and memory efficiency.
 */

import { readFile, writeFile, mkdir, stat, unlink, access } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { globalPool } from './buffer-pool.js';
import { tmpdir } from 'node:os';

// Import crypto
import crypto from 'crypto';

/**
 * Generate a random string of specified length
 * @param length - Length of random string
 * @returns Random hexadecimal string
 */
export function randomString(length: number): string {
  return Array.from(crypto.randomBytes(Math.ceil(length / 2)))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Options for file operations
 */
export interface FileOptions {
  /**
   * Use buffer pooling for better memory efficiency
   * @default true
   */
  useBufferPool?: boolean;

  /**
   * Create parent directories if they don't exist
   * @default true
   */
  ensureDir?: boolean;

  /**
   * Safe write (write to temporary file first, then rename)
   * @default true
   */
  safeWrite?: boolean;

  /**
   * Buffer size for read/write operations
   * @default 64KB
   */
  bufferSize?: number;

  /**
   * Encoding for text operations
   * @default 'utf8'
   */
  encoding?: BufferEncoding;
}

/**
 * File metadata information
 */
export interface FileMetadata {
  /**
   * Path to the file
   */
  path: string;

  /**
   * Size of the file in bytes
   */
  size: number;

  /**
   * File creation timestamp
   */
  created: Date;

  /**
   * File modification timestamp
   */
  modified: Date;

  /**
   * File extension
   */
  extension: string;

  /**
   * File basename (without path)
   */
  basename: string;

  /**
   * MIME type guess based on extension
   */
  mimeType: string;

  /**
   * If the file exists
   */
  exists: boolean;

  /**
   * If the path is a directory
   */
  isDirectory: boolean;
}

/**
 * Default options for file operations
 */
const DEFAULT_OPTIONS: Required<FileOptions> = {
  useBufferPool: true,
  ensureDir: true,
  safeWrite: true,
  bufferSize: 64 * 1024, // 64KB
  encoding: 'utf8'
};

/**
 * Common MIME types mapped to file extensions
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'application/xml',
  '.csv': 'text/csv'
};

/**
 * Temp directory management
 */
let tempDir: string | null = null;

/**
 * Resolve a path, supporting file:// URLs
 */
export function resolvePath(path: string): string {
  if (path.startsWith('file://')) {
    return fileURLToPath(path);
  }
  return path;
}

/**
 * Read a file efficiently
 * @param path - Path to file
 * @param options - Read options
 * @returns File contents
 */
export async function readFileContents(path: string, options: FileOptions = {}): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  path = resolvePath(path);

  try {
    if (opts.useBufferPool) {
      const stats = await stat(path);
      const buffer = globalPool.acquire(stats.size);

      try {
        const fileHandle = await readFile(path);
        fileHandle.copy(buffer);
        return buffer;
      } catch (err) {
        globalPool.release(buffer);
        throw err;
      }
    } else {
      return await readFile(path);
    }
  } catch (err) {
    throw new Error(
      `Failed to read file ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Read a file as text
 * @param path - Path to file
 * @param options - Read options
 * @returns File contents as string
 */
export async function readTextFile(path: string, options: FileOptions = {}): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const buffer = await readFileContents(path, options);
  const text = buffer.toString(opts.encoding);

  if (opts.useBufferPool) {
    globalPool.release(buffer);
  }

  return text;
}

/**
 * Write data to a file efficiently
 * @param path - Path to file
 * @param data - Data to write
 * @param options - Write options
 */
export async function writeFileContents(
  path: string,
  data: Buffer | string,
  options: FileOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  path = resolvePath(path);

  try {
    // Ensure directory exists if requested
    if (opts.ensureDir) {
      await ensureDirectory(dirname(path));
    }

    const buffer = typeof data === 'string' ? Buffer.from(data, opts.encoding) : data;

    if (opts.safeWrite) {
      // Write to temporary file first, then rename
      const tempPath = `${path}.${randomString(8)}.tmp`;
      await writeFile(tempPath, buffer);
      await renameFile(tempPath, path);
    } else {
      await writeFile(path, buffer);
    }
  } catch (err) {
    throw new Error(
      `Failed to write file ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Write text to a file
 * @param path - Path to file
 * @param text - Text to write
 * @param options - Write options
 */
export async function writeTextFile(
  path: string,
  text: string,
  options: FileOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  await writeFileContents(path, text, opts);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dir - Directory path
 */
export async function ensureDirectory(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (_err) {
    // Ignore if directory already exists
    if ((_err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw new Error(
        `Failed to create directory ${dir}: ${_err instanceof Error ? _err.message : String(_err)}`
      );
    }
  }
}

/**
 * Rename a file
 * @param oldPath - Original path
 * @param newPath - New path
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  try {
    // Node's rename has issues with cross-device links
    // Read and write is more reliable for temp files
    const content = await readFile(oldPath);
    await writeFile(newPath, content);
    await unlink(oldPath);
  } catch (err) {
    throw new Error(
      `Failed to rename file ${oldPath} to ${newPath}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Get metadata for a file
 * @param path - Path to file
 * @returns File metadata
 */
export async function getFileMetadata(path: string): Promise<FileMetadata> {
  path = resolvePath(path);

  try {
    const stats = await stat(path);
    const extension = extname(path).toLowerCase();
    const fileBasename = basename(path);

    return {
      path,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      extension,
      basename: fileBasename,
      mimeType: MIME_TYPES[extension] || 'application/octet-stream',
      exists: true,
      isDirectory: stats.isDirectory()
    };
  } catch (err) {
    Logger.error(`Failed to get file metadata for ${path}: ${err instanceof Error ? err.message : String(err)}`);
    return {
      path,
      size: 0,
      created: new Date(0),
      modified: new Date(0),
      extension: extname(path).toLowerCase(),
      basename: basename(path),
      mimeType: 'application/octet-stream',
      exists: false,
      isDirectory: false
    };
  }
}

/**
 * Check if a file exists
 * @param path - Path to file
 * @returns True if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  path = resolvePath(path);

  try {
    await access(path);
    return true;
  } catch (err) {
    Logger.error(`Failed to check if file exists ${path}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Copy a file efficiently
 * @param source - Source path
 * @param destination - Destination path
 * @param options - Copy options
 */
export async function copyFile(
  source: string,
  destination: string,
  options: FileOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  source = resolvePath(source);
  destination = resolvePath(destination);

  try {
    // Ensure destination directory exists
    if (opts.ensureDir) {
      await ensureDirectory(dirname(destination));
    }

    // Use streaming for efficiency
    const readStream = createReadStream(source, {
      highWaterMark: opts.bufferSize
    });
    const writeStream = createWriteStream(opts.safeWrite ? `${destination}.tmp` : destination);

    await pipeline(readStream, writeStream);

    if (opts.safeWrite) {
      await renameFile(`${destination}.tmp`, destination);
    }
  } catch (err) {
    throw new Error(
      `Failed to copy file from ${source} to ${destination}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Stream a file to a writable stream
 * @param path - Path to file
 * @param destination - Destination stream
 * @param options - Stream options
 */
export async function streamFile(
  path: string,
  destination: NodeJS.WritableStream,
  options: FileOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  path = resolvePath(path);

  try {
    const readStream = createReadStream(path, {
      highWaterMark: opts.bufferSize
    });
    await pipeline(readStream, destination);
  } catch (err) {
    throw new Error(
      `Failed to stream file ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get the system temporary directory
 * @returns Path to temporary directory
 */
export function getTempDirectory(): string {
  if (!tempDir) {
    tempDir = tmpdir();
  }
  return tempDir;
}

/**
 * Get a path for a temporary file
 * @param prefix - Prefix for the filename
 * @param suffix - Suffix for the filename
 * @returns Path to a temporary file
 */
export async function getTempFilePath(prefix: string = '', suffix: string = ''): Promise<string> {
  const temp = getTempDirectory();
  const fileName = `${prefix}${randomString(16)}${suffix}`;
  return join(temp, fileName);
}

/**
 * Save a stream to a file
 * @param stream - Stream to save
 * @param filePath - Path to save to
 * @param options - File options
 * @returns Promise that resolves when the stream is saved
 */
export async function saveStreamToFile(
  stream: Readable,
  filePath: string,
  options: FileOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  filePath = resolvePath(filePath);

  if (opts.ensureDir) {
    await ensureDirectory(dirname(filePath));
  }

  try {
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);
  } catch (err) {
    throw new Error(
      `Failed to save stream to file ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Delete a file
 * @param filePath - Path to the file to delete
 */
export async function deleteFile(filePath: string): Promise<void> {
  filePath = resolvePath(filePath);
  try {
    await unlink(filePath);
  } catch (err) {
    // Ignore if file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(
        `Failed to delete file ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/**
 * Get MIME type based on file extension
 * @param filePath - Path to the file
 * @param defaultType - Default MIME type if not found
 * @returns MIME type
 */
export function getMimeType(
  filePath: string,
  defaultType: string = 'application/octet-stream'
): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || defaultType;
}
