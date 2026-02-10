/**
 * @file SessionLock.js
 * @description In-memory per-user lock to prevent concurrent critical operations (e.g., double payment)
 * @responsibility Ensure only one critical operation per chatId runs at a time
 *
 * @architecture Hexagonal Architecture - Application Layer Utility
 * @pattern Mutex / Semaphore (single-instance, in-memory)
 *
 * @security
 * - Auto-expire: Locks expire after MAX_LOCK_DURATION_MS (30s failsafe)
 * - Memory leak prevention: Periodic cleanup of expired locks
 * - Non-blocking: Duplicate requests are rejected immediately, not queued
 *
 * @performance
 * - Zero database overhead (purely in-memory)
 * - O(1) acquire/release via Map
 * - Cleanup runs every CLEANUP_INTERVAL_MS (60s)
 *
 * @limitations
 * - Single-instance only (not shared across processes)
 * - Locks lost on restart (acceptable: locks are short-lived ~seconds)
 *
 * @usage
 * import { sessionLock } from './SessionLock.js';
 * const result = await sessionLock.withLock(chatId, async () => {
 *   return await processPayment(chatId, orderData);
 * });
 * if (result === SessionLock.LOCKED) {
 *   // Already processing, show "please wait" to user
 * }
 */

import logger from '../../../../shared/services/Logger.js';

/** Maximum time a lock can be held before auto-expiry (failsafe) */
const MAX_LOCK_DURATION_MS = 30_000; // 30 seconds

/** Interval for cleaning up expired/orphaned locks */
const CLEANUP_INTERVAL_MS = 60_000; // 60 seconds

/** Sentinel value returned when lock is already held */
const LOCKED = Symbol('SESSION_LOCKED');

class SessionLock {
    constructor() {
        /** @type {Map<string, number>} chatId → timestamp of lock acquisition */
        this._locks = new Map();

        // Periodic cleanup of expired locks (failsafe against stuck locks)
        this._cleanupInterval = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);

        // Allow process to exit cleanly without this interval keeping it alive
        if (this._cleanupInterval.unref) {
            this._cleanupInterval.unref();
        }
    }

    /**
     * Check if a chatId is currently locked
     * @param {string} chatId - Telegram chat identifier
     * @returns {boolean} True if locked and not expired
     */
    isLocked(chatId) {
        const lockTime = this._locks.get(chatId);
        if (!lockTime) return false;

        // Check if lock has expired (failsafe)
        if (Date.now() - lockTime > MAX_LOCK_DURATION_MS) {
            this._locks.delete(chatId);
            logger.warn(`[SessionLock] ⚠️ Auto-expired stale lock | ChatId: ${chatId} | Age: ${Date.now() - lockTime}ms`);
            return false;
        }

        return true;
    }

    /**
     * Execute a function with an exclusive lock per chatId.
     * If the lock is already held, returns LOCKED immediately (non-blocking).
     *
     * @param {string} chatId - Telegram chat identifier
     * @param {Function} fn - Async function to execute under lock
     * @returns {Promise<*|Symbol>} Result of fn, or SessionLock.LOCKED if already locked
     */
    async withLock(chatId, fn) {
        // Non-blocking: reject immediately if already locked
        if (this.isLocked(chatId)) {
            logger.warn(`[SessionLock] 🔒 Rejected concurrent request | ChatId: ${chatId}`);
            return LOCKED;
        }

        // Acquire lock
        this._locks.set(chatId, Date.now());
        logger.debug(`[SessionLock] 🔓 Lock acquired | ChatId: ${chatId}`);

        try {
            return await fn();
        } finally {
            // Always release lock, even if fn() throws
            this._locks.delete(chatId);
            logger.debug(`[SessionLock] 🔓 Lock released | ChatId: ${chatId}`);
        }
    }

    /**
     * Cleanup expired/orphaned locks (failsafe)
     * @private
     */
    _cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [chatId, lockTime] of this._locks) {
            if (now - lockTime > MAX_LOCK_DURATION_MS) {
                this._locks.delete(chatId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`[SessionLock] 🧹 Cleaned up ${cleaned} expired lock(s)`);
        }
    }

    /**
     * Get current lock count (for monitoring/debugging)
     * @returns {number}
     */
    get size() {
        return this._locks.size;
    }

    /**
     * Sentinel value indicating the lock was already held
     * @type {Symbol}
     */
    static get LOCKED() {
        return LOCKED;
    }
}

// Singleton instance (one lock manager per process)
export const sessionLock = new SessionLock();
export { SessionLock };
