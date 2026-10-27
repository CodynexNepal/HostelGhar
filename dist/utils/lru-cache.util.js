"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: lru-cache.util.ts
// PURPOSE: Level 1 (L1) In-Memory LRU (Least Recently Used) Cache with TTL support.
//          - O(1) lookups, inserts, and evictions using JavaScript Map semantics
//          - Configurable maximum size to prevent memory leaks in production Node.js
//          - Per-item TTL with automatic lazy and proactive expiration
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
class LRUCache {
    constructor(options = {}) {
        // Cache statistics for observability
        this.hits = 0;
        this.misses = 0;
        this.maxSize = options.maxSize || 1000;
        this.defaultTtlMs = (options.defaultTtlSeconds || 60) * 1000;
        this.cache = new Map();
    }
    /**
     * Retrieves an item from L1 memory cache.
     * Promotes item to most recently used on hit.
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Refresh position in Map (delete and re-insert makes it most recent)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        return entry.value;
    }
    /**
     * Sets an item in L1 memory cache with specific TTL.
     * Evicts least recently used (first element in Map) if capacity exceeded.
     */
    set(key, value, ttlSeconds) {
        const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
        const expiresAt = Date.now() + ttlMs;
        // If key already exists, delete it first to reset insertion order
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.maxSize) {
            // Evict least recently used (first key in iteration order)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, { value, expiresAt });
    }
    /**
     * Checks if key exists and is not expired without updating LRU order.
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Deletes a specific key from L1 cache.
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Deletes all keys matching a prefix/pattern from L1 cache.
     */
    deletePattern(pattern) {
        let deletedCount = 0;
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}`);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * Returns full keys containing the substring (for cross-tier purges).
     */
    keysContaining(substring) {
        if (!substring)
            return [];
        const out = [];
        for (const key of [...this.cache.keys()]) {
            const entry = this.cache.get(key);
            if (!entry)
                continue;
            if (Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                continue;
            }
            if (key.includes(substring))
                out.push(key);
        }
        return out;
    }
    /**
     * Clears the entire memory cache.
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    /**
     * Returns current number of items in cache.
     */
    size() {
        return this.cache.size;
    }
    /**
     * Returns telemetry stats for L1 cache.
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total) * 100 : 0,
        };
    }
}
exports.LRUCache = LRUCache;
