/**
 * Buffer Pool with Adaptive Sizing
 *
 * This implementation provides buffer recycling with adaptive buffer size
 * management for optimal memory usage patterns.
 */

/**
 * Buffer Pool Configuration
 */
export interface BufferPoolConfig {
  /** Initial number of buffers to pre-allocate */
  initialSize?: number;
  /** Maximum number of buffers to keep in the pool */
  maxSize?: number;
  /** Default size for buffers (16KB) */
  bufferSize?: number;
  /** Factor to grow the pool by when needed */
  growthFactor?: number;
  /** Enable adaptive buffer sizing */
  adaptive?: boolean;
  /** Interval for adaptation in ms */
  adaptiveInterval?: number;
  /** Minimum buffer size (1KB) */
  minBufferSize?: number;
  /** Maximum buffer size (1MB) */
  maxBufferSize?: number;
}

interface BufferPoolStats {
  created: number;
  acquired: number;
  released: number;
  dropped: number;
  totalAllocated: number;
  hits: number;
  misses: number;
  adapts: number;
}

/**
 * Buffer Pool for efficient buffer reuse to reduce allocation overhead
 */
export class BufferPool {
  private config: Required<BufferPoolConfig>;
  private pools: Map<number, Buffer[]>;
  private stats: BufferPoolStats;
  private sizeUsage: Map<number, number>;
  private adaptiveInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new buffer pool
   */
  constructor(config: BufferPoolConfig = {}) {
    this.config = {
      initialSize: config.initialSize || 10,
      maxSize: config.maxSize || 1000,
      bufferSize: config.bufferSize || 16 * 1024, // 16KB default
      growthFactor: config.growthFactor || 1.5,
      adaptive: config.adaptive || false,
      adaptiveInterval: config.adaptiveInterval || 5000, // 5 seconds
      minBufferSize: config.minBufferSize || 1 * 1024, // 1KB
      maxBufferSize: config.maxBufferSize || 1 * 1024 * 1024 // 1MB
    };

    // Initialize buffer pools for different sizes
    this.pools = new Map();

    // Add default size pool
    this.pools.set(this.config.bufferSize, []);

    // Pre-allocate initial buffers
    this.preallocate(this.config.initialSize, this.config.bufferSize);

    // Statistics
    this.stats = {
      created: this.config.initialSize,
      acquired: 0,
      released: 0,
      dropped: 0,
      totalAllocated: this.config.initialSize * this.config.bufferSize,
      hits: 0,
      misses: 0,
      adapts: 0
    };

    // Size usage tracking for adaptive sizing
    this.sizeUsage = new Map();

    // Start adaptive sizing if enabled
    if (this.config.adaptive) {
      this.startAdaptiveSizing();
    }
  }

  /**
   * Pre-allocate buffers in the pool
   * @param count Number of buffers to allocate
   * @param size Size of each buffer
   * @private
   */
  private preallocate(count: number, size: number): void {
    const pool = this.getOrCreatePool(size);
    for (let i = 0; i < count; i++) {
      pool.push(Buffer.allocUnsafe(size));
    }
  }

  /**
   * Get or create a pool for a specific buffer size
   * @param size Buffer size
   * @returns Pool for the requested size
   * @private
   */
  private getOrCreatePool(size: number): Buffer[] {
    // Round size to nearest power of 2 to limit fragmentation
    const normalizedSize = this.normalizeSize(size);

    if (!this.pools.has(normalizedSize)) {
      this.pools.set(normalizedSize, []);
    }

    return this.pools.get(normalizedSize)!;
  }

  /**
   * Normalize size to reduce pool fragmentation
   * @param size Requested size
   * @returns Normalized size
   * @private
   */
  private normalizeSize(size: number): number {
    // Ensure size is within configured bounds
    size = Math.max(size, this.config.minBufferSize);
    size = Math.min(size, this.config.maxBufferSize);

    // Round to powers of 2 to limit fragmentation
    const power = Math.ceil(Math.log2(size));
    return Math.pow(2, power);
  }

  /**
   * Acquire a buffer from the pool or create a new one
   * @param size Desired buffer size
   * @returns A buffer of at least the requested size
   */
  acquire(size: number): Buffer {
    const normalizedSize = this.normalizeSize(size);
    const pool = this.getOrCreatePool(normalizedSize);

    // Track acquisition for this size
    this.trackSizeUsage(normalizedSize);

    // Get buffer from pool or create new one
    let buffer: Buffer;
    if (pool.length > 0) {
      buffer = pool.pop()!;
      this.stats.hits++;
    } else {
      buffer = Buffer.allocUnsafe(normalizedSize);
      this.stats.created++;
      this.stats.totalAllocated += normalizedSize;
      this.stats.misses++;
    }

    this.stats.acquired++;
    return buffer;
  }

  /**
   * Release a buffer back to the pool
   * @param buffer Buffer to release
   */
  release(buffer: Buffer): void {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return;
    }

    const size = buffer.length;
    const normalizedSize = this.normalizeSize(size);
    const pool = this.getOrCreatePool(normalizedSize);

    // Check if pool is full
    if (pool.length >= this.config.maxSize) {
      this.stats.dropped++;
      return;
    }

    // Clear buffer data for security
    buffer.fill(0);

    // Add back to pool
    pool.push(buffer);
    this.stats.released++;
  }

  /**
   * Track buffer size usage for adaptive sizing
   * @param size Buffer size requested
   * @private
   */
  private trackSizeUsage(size: number): void {
    if (!this.config.adaptive) return;

    if (!this.sizeUsage.has(size)) {
      this.sizeUsage.set(size, 0);
    }

    this.sizeUsage.set(size, (this.sizeUsage.get(size) || 0) + 1);
  }

  /**
   * Start adaptive sizing interval
   * @private
   */
  private startAdaptiveSizing(): void {
    this.adaptiveInterval = setInterval(() => {
      this.adaptPools();
    }, this.config.adaptiveInterval);

    // Prevent interval from keeping process alive
    if (this.adaptiveInterval.unref) {
      this.adaptiveInterval.unref();
    }
  }

  /**
   * Stop adaptive sizing
   */
  stopAdaptiveSizing(): void {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
      this.adaptiveInterval = null;
    }
  }

  /**
   * Adapt pools based on usage patterns
   * @private
   */
  private adaptPools(): void {
    if (this.sizeUsage.size === 0) return;

    // Find most frequently used sizes
    const sortedSizes = [...this.sizeUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    // Pre-allocate for most common sizes
    for (const size of sortedSizes) {
      const pool = this.getOrCreatePool(size);

      // If pool is low, pre-allocate more buffers
      const usageCount = this.sizeUsage.get(size) || 0;
      const targetSize = Math.min(
        Math.max(5, Math.ceil(usageCount / 10)),
        this.config.maxSize / 4
      );

      if (pool.length < targetSize) {
        const toAdd = targetSize - pool.length;
        this.preallocate(toAdd, size);
        this.stats.created += toAdd;
        this.stats.totalAllocated += toAdd * size;
        this.stats.adapts++;
      }
    }

    // Clear usage stats for next interval
    this.sizeUsage.clear();
  }

  /**
   * Get pool statistics
   * @returns Pool statistics
   */
  getStats(): BufferPoolStats & { pools: { size: number, count: number }[] } {
    const poolStats = Array.from(this.pools.entries())
      .map(([size, pool]) => ({
        size,
        count: pool.length
      }));

    return {
      ...this.stats,
      pools: poolStats
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    for (const [, pool] of this.pools) {
      pool.length = 0;
    }
    this.pools.clear();
    this.pools.set(this.config.bufferSize, []);
  }
}

// Create a global buffer pool instance
export const globalPool = new BufferPool({
  adaptive: true,
  maxSize: 500
});
