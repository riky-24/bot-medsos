import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { DatabasePort } from '../../../core/shared/ports/DatabasePort.js';
import logger from '../../../core/shared/services/Logger.js';

/**
 * PrismaAdapter - Singleton Pattern
 * Optimized connection pool management with graceful shutdown
 */

// Singleton instance
let prismaInstance = null;

export class PrismaAdapter extends DatabasePort {
  constructor() {
    super();

    // Singleton: reuse existing instance
    if (prismaInstance) {
      this.prisma = prismaInstance;
      this.connected = true;
      return;
    }

    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });

    prismaInstance = this.prisma;
    this.connected = false;
  }

  /**
   * Connect to database
   */
  async connect() {
    if (this.connected) return;

    try {
      await this.prisma.$connect();
      this.connected = true;
      logger.info('[Prisma] ✓ Database connected (pool optimized)');
    } catch (error) {
      logger.error(`[Prisma] Connection error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (!this.connected) return;

    try {
      await this.prisma.$disconnect();
      this.connected = false;
      prismaInstance = null;
      logger.info('[Prisma] Database disconnected');
    } catch (error) {
      logger.error(`[Prisma] Disconnect error: ${error.message}`);
    }
  }

  /**
   * Get Prisma client instance
   */
  get client() {
    return this.prisma;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Health check with metrics
   */
  async healthCheck() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      const stats = await this.getPoolStats();

      return {
        status: 'healthy',
        latency: `${latency}ms`,
        pool: stats,
        connected: this.connected
      };
    } catch (error) {
      logger.error(`[Prisma] Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Get connection pool stats
   */
  async getPoolStats() {
    try {
      // Note: This only works for PostgreSQL
      const result = await this.prisma.$queryRaw`
        SELECT 
          CAST(count(*) FILTER (WHERE state = 'active') AS INTEGER) as active,
          CAST(count(*) FILTER (WHERE state = 'idle') AS INTEGER) as idle,
          CAST(count(*) AS INTEGER) as total
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      return result[0];
    } catch (error) {
      return { error: error.message };
    }
  }
}
