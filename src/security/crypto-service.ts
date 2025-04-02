/**
 * Symmetric Encryption Service
 *
 * Provides secure symmetric encryption for sensitive data with:
 * - AES-256-GCM algorithm for authenticated encryption
 * - Key derivation using PBKDF2
 * - Secure key rotation and versioning
 * - Automatic initialization vector generation
 * - Authenticated data support
 */

import * as crypto from 'node:crypto';

/**
 * Extend the crypto interfaces with authentication methods
 */
interface AuthenticatedCipher extends crypto.Cipher {
  setAuthTagLength(length: number): this;
  setAAD(buffer: Buffer): this;
  getAuthTag(): Buffer;
}

interface AuthenticatedDecipher extends crypto.Decipher {
  setAuthTag(buffer: Buffer): this;
  setAAD(buffer: Buffer): this;
}

/**
 * Encryption algorithm options
 */
export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc',
  AES_192_GCM = 'aes-192-gcm',
  CHACHA20_POLY1305 = 'chacha20-poly1305'
}

/**
 * Key derivation options
 */
export interface KeyDerivationOptions {
  /**
   * Salt for key derivation
   */
  salt: Buffer;

  /**
   * Number of iterations for PBKDF2
   * @default 100000
   */
  iterations?: number;

  /**
   * Hash algorithm for PBKDF2
   * @default sha256
   */
  hash?: string;

  /**
   * Key length in bytes
   * @default 32 (256 bits)
   */
  keyLength?: number;
}

/**
 * Encryption options
 */
export interface EncryptionOptions {
  /**
   * Encryption algorithm to use
   * @default aes-256-gcm
   */
  algorithm?: EncryptionAlgorithm;

  /**
   * Additional authenticated data (AAD) for GCM mode
   */
  aad?: Buffer;

  /**
   * Key version for key rotation
   * @default 1
   */
  keyVersion?: number;

  /**
   * Tag length for GCM mode
   * @default 16
   */
  tagLength?: number;
}

/**
 * Encrypted data format
 */
export interface EncryptedData {
  /**
   * Encrypted content
   */
  content: Buffer;

  /**
   * Initialization vector
   */
  iv: Buffer;

  /**
   * Authentication tag (for GCM mode)
   */
  tag?: Buffer;

  /**
   * Algorithm used for encryption
   */
  algorithm: string;

  /**
   * Key version used for encryption
   */
  keyVersion: number;
}

/**
 * Master key for encrypting/decrypting data
 */
interface MasterKey {
  /**
   * Key version
   */
  version: number;

  /**
   * Key material
   */
  key: Buffer;

  /**
   * Creation timestamp
   */
  createdAt: Date;
}

/**
 * Crypto service for symmetric encryption
 */
export class CryptoService {
  private keys: Map<number, MasterKey> = new Map();
  private defaultKeyVersion: number = 1;
  private readonly keyDerivationOptions: KeyDerivationOptions;

  /**
   * Create a new crypto service
   * @param masterPassword Master password for key derivation
   * @param options Key derivation options
   */
  constructor(
    private readonly masterPassword: string,
    options?: Partial<KeyDerivationOptions>
  ) {
    if (!masterPassword || masterPassword.length < 12) {
      throw new Error('Master password must be at least 12 characters long');
    }

    // Default salt if not provided
    const salt = options?.salt || crypto.randomBytes(16);

    this.keyDerivationOptions = {
      salt,
      iterations: options?.iterations || 100000,
      hash: options?.hash || 'sha256',
      keyLength: options?.keyLength || 32
    };

    // Generate initial key
    this.generateKey(1);
  }

  /**
   * Generate a new master key with a specific version
   * @param version Key version
   */
  generateKey(version: number): void {
    if (this.keys.has(version)) {
      throw new Error(`Key with version ${version} already exists`);
    }

    const key = crypto.pbkdf2Sync(
      this.masterPassword,
      Buffer.concat([this.keyDerivationOptions.salt, Buffer.from(version.toString())]),
      this.keyDerivationOptions.iterations || 100000,
      this.keyDerivationOptions.keyLength || 32,
      this.keyDerivationOptions.hash || 'sha256'
    );

    this.keys.set(version, {
      version,
      key,
      createdAt: new Date()
    });
  }

  /**
   * Rotate keys and set a new default key version
   * @returns The new key version
   */
  rotateKeys(): number {
    const newVersion = this.defaultKeyVersion + 1;
    this.generateKey(newVersion);
    this.defaultKeyVersion = newVersion;
    return newVersion;
  }

  /**
   * Set the default key version
   * @param version Key version to use as default
   */
  setDefaultKeyVersion(version: number): void {
    if (!this.keys.has(version)) {
      throw new Error(`Key with version ${version} does not exist`);
    }
    this.defaultKeyVersion = version;
  }

  /**
   * Encrypt data using symmetric encryption
   * @param plaintext Data to encrypt
   * @param options Encryption options
   * @returns Encrypted data
   */
  encrypt(plaintext: Buffer | string, options?: EncryptionOptions): EncryptedData {
    // Get options with defaults
    const algorithm = options?.algorithm || EncryptionAlgorithm.AES_256_GCM;
    const keyVersion = options?.keyVersion || this.defaultKeyVersion;
    const tagLength = options?.tagLength || 16;
    const aad = options?.aad;

    // Get key
    const masterKey = this.keys.get(keyVersion);
    if (!masterKey) {
      throw new Error(`Key with version ${keyVersion} does not exist`);
    }

    // Generate a random IV
    const iv = crypto.randomBytes(algorithm.includes('gcm') ? 12 : 16);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, masterKey.key, iv);

    // Handle authenticated encryption (GCM mode)
    if (algorithm.includes('gcm')) {
      const authCipher = cipher as AuthenticatedCipher;
      authCipher.setAuthTagLength(tagLength);

      // Add AAD if provided
      if (aad) {
        authCipher.setAAD(aad);
      }
    }

    // Encrypt data
    const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
    const encryptedContent = Buffer.concat([cipher.update(data), cipher.final()]);

    // Get auth tag if using GCM mode
    const tag = algorithm.includes('gcm')
      ? (cipher as AuthenticatedCipher).getAuthTag()
      : undefined;

    return {
      content: encryptedContent,
      iv,
      tag,
      algorithm,
      keyVersion
    };
  }

  /**
   * Decrypt data using symmetric encryption
   * @param encryptedData Encrypted data
   * @param options Decryption options
   * @returns Decrypted data
   */
  decrypt(
    encryptedData: EncryptedData,
    options?: { aad?: Buffer; encoding?: BufferEncoding }
  ): Buffer {
    // Get key
    const masterKey = this.keys.get(encryptedData.keyVersion);
    if (!masterKey) {
      throw new Error(`Key with version ${encryptedData.keyVersion} does not exist`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(
      encryptedData.algorithm,
      masterKey.key,
      encryptedData.iv
    );

    // Handle authenticated encryption (GCM mode)
    if (encryptedData.algorithm.includes('gcm')) {
      const authDecipher = decipher as AuthenticatedDecipher;

      // Set auth tag
      if (!encryptedData.tag) {
        throw new Error('Auth tag is required for GCM mode');
      }
      authDecipher.setAuthTag(encryptedData.tag);

      // Add AAD if provided
      if (options?.aad) {
        authDecipher.setAAD(options.aad);
      }
    }

    // Decrypt data
    return Buffer.concat([decipher.update(encryptedData.content), decipher.final()]);
  }

  /**
   * Encrypt an object using JSON serialization
   * @param obj Object to encrypt
   * @param options Encryption options
   * @returns Encrypted data string (base64)
   */
  encryptObject<T>(obj: T, options?: EncryptionOptions): string {
    // Serialize object to JSON
    const json = JSON.stringify(obj);

    // Encrypt the JSON string
    const encrypted = this.encrypt(json, options);

    // Serialize the encrypted data to JSON and encode as base64
    return Buffer.from(
      JSON.stringify({
        c: encrypted.content.toString('base64'),
        i: encrypted.iv.toString('base64'),
        t: encrypted.tag?.toString('base64'),
        a: encrypted.algorithm,
        v: encrypted.keyVersion
      })
    ).toString('base64');
  }

  /**
   * Decrypt an object using JSON deserialization
   * @param encryptedStr Encrypted data string (base64)
   * @param options Decryption options
   * @returns Decrypted object
   */
  decryptObject<T>(encryptedStr: string, options?: { aad?: Buffer }): T {
    // Decode base64 and parse JSON
    const parsed = JSON.parse(Buffer.from(encryptedStr, 'base64').toString());

    // Reconstruct encrypted data
    const encryptedData: EncryptedData = {
      content: Buffer.from(parsed.c, 'base64'),
      iv: Buffer.from(parsed.i, 'base64'),
      tag: parsed.t ? Buffer.from(parsed.t, 'base64') : undefined,
      algorithm: parsed.a,
      keyVersion: parsed.v
    };

    // Decrypt the data
    const decrypted = this.decrypt(encryptedData, options);

    // Parse the JSON string to object
    return JSON.parse(decrypted.toString());
  }

  /**
   * Generate a secure random key
   * @param length Key length in bytes
   * @returns Random key as Buffer
   */
  static generateRandomKey(length: number = 32): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Generate a secure password with cryptographic randomness
   * @param length Password length
   * @returns Secure random password
   */
  static generateSecurePassword(length: number = 24): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
    const randomBytes = crypto.randomBytes(length);
    let result = '';

    for (let i = 0; i < length; i++) {
      // Ensure randomBytes[i] is treated as a number and not undefined
      const byteValue = randomBytes[i] || 0;
      const index = byteValue % charset.length;
      result += charset[index];
    }

    return result;
  }

  /**
   * Create a secure hash of a password
   * @param password Password to hash
   * @returns Hashed password
   */
  static hashPassword(password: string): string {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');

    // Hash the password with the salt
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

    // Return the salt and hash together
    return `${salt}:${hash}`;
  }

  /**
   * Verify a password against a hash
   * @param password Password to verify
   * @param hashedPassword Hashed password
   * @returns Whether the password matches
   */
  static verifyPassword(password: string, hashedPassword: string): boolean {
    // Extract salt from stored hash
    const parts = hashedPassword.split(':');
    if (parts.length !== 2) {
      return false;
    }

    const salt = parts[0];
    const storedHash = parts[1];

    // Verify salt exists before proceeding
    if (!salt) {
      return false;
    }

    // Compute hash of provided password with same salt
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

    // Compare hashes using constant-time comparison
    // Make sure we have valid strings before comparing
    if (!storedHash) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(verifyHash));
  }
}
