import { fileManager } from './fileManager';

// File cache interface
interface CachedFile {
  buffer: Buffer;
  mimeType: string;
  cachedAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

// In-memory file cache for efficient file access
export class FileCache {
  private cache: Map<string, CachedFile> = new Map();
  private readonly maxCacheSize: number = 100 * 1024 * 1024; // 100MB total cache
  private readonly maxFileAge: number = 30 * 60 * 1000; // 30 minutes
  private readonly maxCacheEntries: number = 1000;
  private currentCacheSize: number = 0;

  // Generate cache key
  private generateKey(orderId: string, filename: string): string {
    return `${orderId}:${filename}`;
  }

  // Add file to cache
  async cacheFile(orderId: string, filename: string): Promise<{
    success: boolean;
    cached?: boolean;
    error?: string;
  }> {
    const key = this.generateKey(orderId, filename);

    // Check if already cached
    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      cached.accessCount++;
      cached.lastAccessed = new Date();
      return { success: true, cached: true };
    }

    try {
      // Get file from file manager
      const fileResult = await fileManager.getFile(orderId, filename);
      if (!fileResult.success || !fileResult.buffer) {
        return { success: false, error: fileResult.error };
      }

      // Check cache size limits
      if (this.shouldEvict(fileResult.buffer.length)) {
        await this.evictLeastUsed();
      }

      // Add to cache
      const cachedFile: CachedFile = {
        buffer: fileResult.buffer,
        mimeType: fileResult.mimeType || 'application/octet-stream',
        cachedAt: new Date(),
        accessCount: 1,
        lastAccessed: new Date(),
      };

      this.cache.set(key, cachedFile);
      this.currentCacheSize += fileResult.buffer.length;

      return { success: true, cached: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cache file'
      };
    }
  }

  // Get file from cache
  async getFile(orderId: string, filename: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    mimeType?: string;
    fromCache?: boolean;
    error?: string;
  }> {
    const key = this.generateKey(orderId, filename);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      // Update access statistics
      cached.accessCount++;
      cached.lastAccessed = new Date();
      
      return {
        success: true,
        buffer: cached.buffer,
        mimeType: cached.mimeType,
        fromCache: true,
      };
    }

    // Try to cache and return the file
    const cacheResult = await this.cacheFile(orderId, filename);
    if (!cacheResult.success) {
      return { success: false, error: cacheResult.error };
    }

    // Return from cache (now that it's cached)
    const newlyCached = this.cache.get(key);
    if (newlyCached) {
      return {
        success: true,
        buffer: newlyCached.buffer,
        mimeType: newlyCached.mimeType,
        fromCache: false,
      };
    }

    return { success: false, error: 'Failed to retrieve file' };
  }

  // Remove file from cache
  removeFile(orderId: string, filename: string): boolean {
    const key = this.generateKey(orderId, filename);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.currentCacheSize -= cached.buffer.length;
      return this.cache.delete(key);
    }
    
    return false;
  }

  // Clear entire cache
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  // Check if we should evict files
  private shouldEvict(newFileSize: number): boolean {
    return (
      this.cache.size >= this.maxCacheEntries ||
      this.currentCacheSize + newFileSize > this.maxCacheSize
    );
  }

  // Evict least recently used files
  private async evictLeastUsed(): Promise<void> {
    if (this.cache.size === 0) return;

    // Sort by last accessed time and access count
    const entries = Array.from(this.cache.entries())
      .map(([key, value]) => ({
        key,
        value,
        score: value.lastAccessed.getTime() + (value.accessCount * 1000), // Favor frequently accessed files
      }))
      .sort((a, b) => a.score - b.score);

    // Remove oldest entries until we have enough space
    const targetSize = this.maxCacheSize * 0.8; // Target 80% of max size
    let removed = 0;

    for (const { key, value } of entries) {
      if (this.currentCacheSize <= targetSize) break;
      
      this.cache.delete(key);
      this.currentCacheSize -= value.buffer.length;
      removed++;
    }

    console.log(`Evicted ${removed} files from cache`);
  }

  // Clean up expired files
  cleanupExpired(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now - value.cachedAt.getTime() > this.maxFileAge) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const cached = this.cache.get(key);
      if (cached) {
        this.currentCacheSize -= cached.buffer.length;
        this.cache.delete(key);
      }
    }

    return expiredKeys.length;
  }

  // Get cache statistics
  getStats(): {
    entries: number;
    totalSize: number;
    hitRate: number;
    averageAccessCount: number;
  } {
    if (this.cache.size === 0) {
      return {
        entries: 0,
        totalSize: 0,
        hitRate: 0,
        averageAccessCount: 0,
      };
    }

    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, cached) => sum + cached.accessCount, 0);

    return {
      entries: this.cache.size,
      totalSize: this.currentCacheSize,
      hitRate: 0, // Would need to track hits/misses separately
      averageAccessCount: totalAccess / this.cache.size,
    };
  }

  // Preload commonly accessed files
  async preloadFiles(orderFiles: Array<{ orderId: string; filename: string }>): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const { orderId, filename } of orderFiles) {
      try {
        const result = await this.cacheFile(orderId, filename);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  // Start automatic cleanup
  startAutoCleanup(intervalMs: number = 5 * 60 * 1000): void {
    setInterval(() => {
      const cleaned = this.cleanupExpired();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired cache entries`);
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const fileCache = new FileCache();
