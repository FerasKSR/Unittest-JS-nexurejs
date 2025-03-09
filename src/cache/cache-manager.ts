/**
 * Cache manager for NexureJS
 *
 * Provides a unified interface for different caching strategies
 * including in-memory, Redis, and Memcached.
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /**
   * Time-to-live in milliseconds (0 = no expiration)
   */
  ttl?: number;

  /**
   * Namespace for the cache key
   */
  namespace?: string;
}

/**
 * Cache store interface
 */
export interface CacheStore {
  /**
   * Get a value from the cache
   * @param key The cache key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param options Cache options
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a value from the cache
   * @param key The cache key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all values from the cache
   * @param namespace Optional namespace to clear
   */
  clear(namespace?: string): Promise<void>;
}

/**
 * In-memory cache store implementation
 */
export class MemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get a value from the cache
   * @param key The cache key
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if the entry has expired
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param options Cache options
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 0;
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;

    const entry: CacheEntry<T> = {
      value,
      expiresAt
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Delete a value from the cache
   * @param key The cache key
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * Clear all values from the cache
   * @param namespace Optional namespace to clear
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      const prefix = `${namespace}:`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Cache manager class
 */
export class CacheManager {
  private stores = new Map<string, CacheStore>();
  private defaultStore: string;

  /**
   * Create a new cache manager
   * @param defaultStore The default store to use
   */
  constructor(defaultStore: string = 'memory') {
    this.defaultStore = defaultStore;

    // Register the default in-memory store
    this.registerStore('memory', new MemoryCacheStore());
  }

  /**
   * Register a cache store
   * @param name The name of the store
   * @param store The store implementation
   */
  registerStore(name: string, store: CacheStore): void {
    this.stores.set(name, store);
  }

  /**
   * Get a cache store
   * @param name The name of the store
   */
  getStore(name?: string): CacheStore {
    const storeName = name || this.defaultStore;
    const store = this.stores.get(storeName);

    if (!store) {
      throw new Error(`Cache store not found: ${storeName}`);
    }

    return store;
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @param storeName Optional store name
   */
  async get<T>(key: string, storeName?: string): Promise<T | null> {
    const store = this.getStore(storeName);
    return store.get<T>(key);
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param options Cache options
   * @param storeName Optional store name
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}, storeName?: string): Promise<void> {
    const store = this.getStore(storeName);
    return store.set<T>(key, value, options);
  }

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   * @param storeName Optional store name
   */
  async has(key: string, storeName?: string): Promise<boolean> {
    const store = this.getStore(storeName);
    return store.has(key);
  }

  /**
   * Delete a value from the cache
   * @param key The cache key
   * @param storeName Optional store name
   */
  async delete(key: string, storeName?: string): Promise<boolean> {
    const store = this.getStore(storeName);
    return store.delete(key);
  }

  /**
   * Clear all values from the cache
   * @param namespace Optional namespace to clear
   * @param storeName Optional store name
   */
  async clear(namespace?: string, storeName?: string): Promise<void> {
    const store = this.getStore(storeName);
    return store.clear(namespace);
  }

  /**
   * Create a namespaced cache key
   * @param key The base key
   * @param namespace The namespace
   */
  createKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }
}
