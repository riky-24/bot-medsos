import { RATE_LIMIT_MS } from '../config/constants.js';
import logger from './Logger.js';

export class RateLimiter {
  /**
   * @param {Object} options 
   * @param {number} options.limitMs - Minimum interval between requests (Cooldown mode)
   * @param {number} options.windowMs - Time window for quota (Quota mode)
   * @param {number} options.maxRequests - Max requests within windowMs (Quota mode)
   */
  constructor(options = {}) {
    this.limitMs = options.limitMs || 0;
    this.windowMs = options.windowMs || 0;
    this.maxRequests = options.maxRequests || 1;

    this.requests = new Map(); // { userId: [timestamps] } or { userId: lastTimestamp }

    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanup(), 60000);
      if (timer.unref) timer.unref();
    }
  }

  /**
   * Check if user can make a request
   */
  canRequest(userId) {
    const now = Date.now();

    // 1. Cooldown Mode (Simple interval)
    if (this.limitMs > 0 && !this.windowMs) {
      const last = this.requests.get(userId) || 0;
      if (now - last < this.limitMs) return false;
      this.requests.set(userId, now);
      return true;
    }

    // 2. Quota/Burst Mode (Sliding Window)
    if (this.windowMs > 0) {
      let userRequests = this.requests.get(userId) || [];

      // Filter out requests outside the window
      userRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);

      if (userRequests.length >= this.maxRequests) {
        return false;
      }

      userRequests.push(now);
      this.requests.set(userId, userRequests);
      return true;
    }

    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, data] of this.requests.entries()) {
      if (this.windowMs > 0) {
        const filtered = data.filter(t => now - t < this.windowMs);
        if (filtered.length === 0) this.requests.delete(userId);
        else this.requests.set(userId, filtered);
      } else {
        if (now - data > this.limitMs + 5000) this.requests.delete(userId);
      }
    }
  }
}
