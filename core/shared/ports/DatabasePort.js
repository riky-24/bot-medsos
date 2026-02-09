/**
 * DatabasePort - Interface for database operations
 * 
 * This port defines the contract for database adapters.
 * Any database adapter (Prisma, TypeORM, etc.) must implement these methods.
 */
export class DatabasePort {
  /**
   * Connect to database
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('DatabasePort.connect() must be implemented by adapter');
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('DatabasePort.disconnect() must be implemented by adapter');
  }

  /**
   * Get database client for direct access
   * This allows services to use Prisma client directly when needed
   * @returns {Object} Database client (e.g., Prisma client)
   */
  get client() {
    throw new Error('DatabasePort.client must be implemented by adapter');
  }

  /**
   * Check if database is connected
   * @returns {Boolean}
   */
  isConnected() {
    throw new Error('DatabasePort.isConnected() must be implemented by adapter');
  }

  /**
   * Health check for database connection
   * @returns {Promise<Object>} Health status with metrics
   */
  async healthCheck() {
    throw new Error('DatabasePort.healthCheck() must be implemented by adapter');
  }
}
