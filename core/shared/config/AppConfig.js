/**
 * AppConfig
 * Centralized configuration management
 * Validates environment variables on startup
 */
export class AppConfig {
  /**
   * Validate required environment variables
   * @throws {Error} If required vars are missing
   */
  static validate() {
    const required = [
      'TELEGRAM_TOKEN',
      'DATABASE_URL',
      'SAKURUPIAH_API_KEY',
      'SAKURUPIAH_API_ID'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  
  /**
   * Environment mode configuration
   */
  static get environment() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production'
    };
  }
  
  /**
   * Database connection pool configuration
   */
  static get database() {
    return {
      url: process.env.DATABASE_URL,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
      poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT) || 10,
      connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 5
    };
  }
  
  /**
   * Retry configuration for failed operations
   */
  static get retry() {
    return {
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
    };
  }
  
  /**
   * Cache configuration
   */
  static get cache() {
    return {
      ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour in seconds
      enabled: process.env.CACHE_ENABLED !== 'false'
    };
  }
  
  /**
   * Telegram bot configuration
   */
  static get telegram() {
    return {
      token: process.env.TELEGRAM_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      pollingInterval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL) || 1000
    };
  }
  
  /**
   * Payment gateway configuration
   */
  static get payment() {
    return {
      sakurupiah: {
        apiKey: process.env.SAKURUPIAH_API_KEY,
        apiId: process.env.SAKURUPIAH_API_ID,
        baseUrl: process.env.SAKURUPIAH_BASE_URL || 'https://sakurupiah.id/api-sanbox'
      }
    };
  }
  
  /**
   * Game provider configuration
   */
  static get gameProvider() {
    return {
      vipreseller: {
        apiKey: process.env.VIPRESELLER_API_KEY,
        apiId: process.env.VIPRESELLER_API_ID
      }
    };
  }
  
  /**
   * Logging configuration
   */
  static get logging() {
    return {
      level: process.env.LOG_LEVEL || 'info',
      enabled: process.env.LOG_ENABLED !== 'false'
    };
  }
  
  /**
   * Server configuration
   */
  static get server() {
    return {
      healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 3001,
      callbackPort: parseInt(process.env.CALLBACK_PORT) || 3000
    };
  }
}
