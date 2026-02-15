/**
 * @fileoverview Centralized Configuration Management
 * Single source of truth untuk semua konfigurasi aplikasi.
 * Semua environment variables di-load dan di-validate di sini.
 * 
 * @module AppConfig
 * @see {@link file://.env.example} untuk list lengkap environment variables
 */

/**
 * AppConfig - Centralized Configuration Manager
 * 
 * Best Practices:
 * - Gunakan AppConfig.xxx.yyy untuk akses config, JANGAN langsung process.env
 * - Semua config di-freeze (immutable) untuk prevent accidental modification
 * - Validation dilakukan saat startup (fail-fast)
 * - Default values aman untuk development, production harus explicit
 * 
 * @example
 * // ✅ Good
 * const port = AppConfig.app.port;
 * const dbUrl = AppConfig.database.url;
 * 
 * // ❌ Bad - jangan akses process.env langsung
 * const port = process.env.PORT;
 */
export class AppConfig {
  /**
   * Validate required environment variables
   * Dipanggil saat startup untuk fail-fast jika config tidak lengkap
   * 
   * @throws {Error} Jika required environment variables tidak ada
   * @returns {void}
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
      const errorMsg = [
        `❌ Missing required environment variables: ${missing.join(', ')}`,
        '',
        '💡 Fix:',
        '1. Copy .env.example ke .env',
        '2. Set values untuk: ' + missing.join(', '),
        '3. Restart aplikasi',
        '',
        'Docs: file://docs/CONFIG_GUIDE.md'
      ].join('\n');

      throw new Error(errorMsg);
    }

    // Validate format untuk critical configs
    this._validateFormats();
  }

  /**
   * Validate format dan values dari critical configs
   * @private
   */
  static _validateFormats() {
    // Validate DATABASE_URL format
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://')) {
      throw new Error('DATABASE_URL must start with postgresql://');
    }

    // Validate PORT adalah number
    if (process.env.PORT && isNaN(parseInt(process.env.PORT, 10))) {
      throw new Error('PORT must be a valid number');
    }

    // Validate TELEGRAM_TOKEN format (basic check)
    const telegramToken = process.env.TELEGRAM_TOKEN;
    if (telegramToken && !telegramToken.includes(':')) {
      console.warn('⚠️  TELEGRAM_TOKEN might be invalid (expected format: 123456:ABC-DEF...)');
    }
  }

  /**
   * Helper: Parse integer with validation
   * @private
   * @param {string} value - Value to parse
   * @param {number} defaultValue - Default if parse fails
   * @param {number} min - Minimum allowed value (optional)
   * @param {number} max - Maximum allowed value (optional)
   * @returns {number}
   */
  static _parseInt(value, defaultValue, min = null, max = null) {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`⚠️  Invalid number: "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }
    if (min !== null && parsed < min) {
      console.warn(`⚠️  Value ${parsed} below minimum ${min}, using default: ${defaultValue}`);
      return defaultValue;
    }
    if (max !== null && parsed > max) {
      console.warn(`⚠️  Value ${parsed} above maximum ${max}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Helper: Get base URL (extracted to avoid circular dependency)
   * @private
   * @returns {string}
   */
  static _getBaseUrl() {
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    return process.env.APP_BASE_URL ||
      process.env.WEBHOOK_URL ||
      (isDev ? 'http://localhost:3000' : 'https://bot.opinionry.my.id');
  }

  /**
   * Application-level configuration
   * 
   * @typedef {Object} AppConfiguration
   * @property {string} baseUrl - Public base URL untuk webhooks (MUST be HTTPS in production)
   * @property {number} port - HTTP server port
   * @property {string|undefined} adminChatId - Telegram chat ID untuk admin notifications
   * @property {boolean} enableAutoTunnel - Auto-start Cloudflare Tunnel
   * 
   * @returns {Readonly<AppConfiguration>}
   */
  static get app() {
    return Object.freeze({
      baseUrl: this._getBaseUrl(),
      port: this._parseInt(process.env.PORT, 3000, 1, 65535),
      adminChatId: process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : undefined,
      enableAutoTunnel: process.env.ENABLE_AUTO_TUNNEL === 'true'
    });
  }

  /**
   * Environment mode configuration
   * 
   * @typedef {Object} EnvironmentConfig
   * @property {string} nodeEnv - Node environment (development|staging|production)
   * @property {boolean} isDevelopment - True jika development mode
   * @property {boolean} isProduction - True jika production mode
   * @property {boolean} isStaging - True jika staging mode
   * 
   * @returns {Readonly<EnvironmentConfig>}
   */
  static get environment() {
    const env = process.env.NODE_ENV || 'development';

    return Object.freeze({
      nodeEnv: env,
      isDevelopment: env === 'development',
      isProduction: env === 'production',
      isStaging: env === 'staging'
    });
  }

  /**
   * Database connection pool configuration
   * 
   * @typedef {Object} DatabaseConfig
   * @property {string} url - PostgreSQL connection URL
   * @property {number} connectionLimit - Max concurrent connections (default: 20)
   * @property {number} poolTimeout - Pool timeout dalam seconds (default: 10)
   * @property {number} connectTimeout - Connection timeout dalam seconds (default: 5)
   * 
   * @returns {Readonly<DatabaseConfig>}
   */
  static get database() {
    return Object.freeze({
      url: process.env.DATABASE_URL,
      connectionLimit: this._parseInt(process.env.DB_CONNECTION_LIMIT, 20, 1, 1000),
      poolTimeout: this._parseInt(process.env.DB_POOL_TIMEOUT, 10, 1, 300),
      connectTimeout: this._parseInt(process.env.DB_CONNECT_TIMEOUT, 5, 1, 60)
    });
  }

  /**
   * Retry configuration untuk failed operations
   * 
   * @typedef {Object} RetryConfig
   * @property {number} maxRetries - Maximum retry attempts (default: 3)
   * @property {number} retryDelay - Delay between retries dalam ms (default: 1000)
   * 
   * @returns {Readonly<RetryConfig>}
   */
  static get retry() {
    return Object.freeze({
      maxRetries: this._parseInt(process.env.MAX_RETRIES, 3, 0, 10),
      retryDelay: this._parseInt(process.env.RETRY_DELAY, 1000, 0, 60000)
    });
  }

  /**
   * Cache configuration
   * 
   * @typedef {Object} CacheConfig
   * @property {number} ttl - Time to live dalam seconds (default: 3600 = 1 hour)
   * @property {boolean} enabled - Enable/disable cache (default: true)
   * 
   * @returns {Readonly<CacheConfig>}
   */
  static get cache() {
    return Object.freeze({
      ttl: this._parseInt(process.env.CACHE_TTL, 3600, 0, 86400),
      enabled: process.env.CACHE_ENABLED !== 'false' && process.env.CACHE_ENABLED !== '0'
    });
  }

  /**
   * Telegram bot configuration
   * 
   * @typedef {Object} TelegramConfig
   * @property {string} token - Bot token dari @BotFather
   * @property {string} webhookUrl - Webhook URL (dari app.baseUrl)
   * @property {string|undefined} webhookSecret - Secret token untuk validate webhook requests
   * @property {number} pollingInterval - Polling interval dalam ms (default: 1000)
   * @property {string} description - Bot description (optional override)
   * @property {string} about - Bot about text (optional override)
   * 
   * @returns {Readonly<TelegramConfig>}
   */
  static get telegram() {
    return Object.freeze({
      token: process.env.TELEGRAM_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || this._getBaseUrl(),
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET,
      pollingInterval: this._parseInt(process.env.TELEGRAM_POLLING_INTERVAL, 1000, 100, 10000),
      description: process.env.BOT_DESCRIPTION,
      about: process.env.BOT_ABOUT
    });
  }

  /**
   * Payment gateway configuration
   * 
   * @typedef {Object} PaymentConfig
   * @property {Object} sakurupiah - Sakurupiah payment gateway config
   * @property {string} sakurupiah.apiKey - API key
   * @property {string} sakurupiah.apiId - Merchant ID
   * @property {string} sakurupiah.baseUrl - API base URL (sandbox or production)
   * @property {string|undefined} callbackUrl - Payment callback URL
   * @property {string|undefined} returnUrl - Payment return/redirect URL
   * 
   * @returns {Readonly<PaymentConfig>}
   */
  static get payment() {
    const baseUrl = this._getBaseUrl();

    return Object.freeze({
      sakurupiah: Object.freeze({
        apiKey: process.env.SAKURUPIAH_API_KEY,
        apiId: process.env.SAKURUPIAH_API_ID,
        baseUrl: process.env.SAKURUPIAH_BASE_URL || 'https://sakurupiah.id/api-sanbox'  // typo in API docs!
      }),
      callbackUrl: process.env.PAYMENT_CALLBACK_URL || `${baseUrl}/callback/payment`,
      returnUrl: process.env.PAYMENT_RETURN_URL || `${baseUrl}/invoice`
    });
  }

  /**
   * Game provider configuration
   * 
   * @typedef {Object} GameProviderConfig
   * @property {Object} vipreseller - VIPReseller game provider config
   * @property {string|undefined} vipreseller.apiKey - API key
   * @property {string|undefined} vipreseller.apiId - API ID
   * @property {string} vipreseller.baseUrl - API base URL
   * 
   * @returns {Readonly<GameProviderConfig>}
   */
  static get gameProvider() {
    return Object.freeze({
      vipreseller: Object.freeze({
        apiKey: process.env.VIPRESELLER_API_KEY,
        apiId: process.env.VIPRESELLER_API_ID,
        baseUrl: process.env.VIPRESELLER_BASE_URL || 'https://vip-reseller.co.id/api/game-feature'
      })
    });
  }

  /**
   * Cloudflare Tunnel configuration
   * 
   * @typedef {Object} CloudflareConfig
   * @property {string|undefined} token - Cloudflare Tunnel token
   * @property {number} port - Port untuk tunnel (default: app.port)
   * 
   * @returns {Readonly<CloudflareConfig>}
   */
  static get cloudflare() {
    return Object.freeze({
      token: process.env.CLOUDFLARE_TUNNEL_TOKEN,
      port: this.app.port
    });
  }

  /**
   * Logging configuration
   * 
   * @typedef {Object} LoggingConfig
   * @property {string} level - Log level (debug|info|warn|error) (default: info)
   * @property {boolean} enabled - Enable/disable logging (default: true)
   * 
   * @returns {Readonly<LoggingConfig>}
   */
  static get logging() {
    const isDev = this.environment.isDevelopment;

    return Object.freeze({
      level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
      enabled: process.env.LOG_ENABLED !== 'false'
    });
  }

  /**
   * Server configuration
   * 
   * @typedef {Object} ServerConfig
   * @property {number} healthCheckPort - Health check server port (default: 3001)
   * @property {number} callbackPort - Callback server port (default: app.port)
   * 
   * @returns {Readonly<ServerConfig>}
   */
  static get server() {
    return Object.freeze({
      healthCheckPort: this._parseInt(process.env.HEALTH_CHECK_PORT, 3001, 1, 65535),
      callbackPort: this._parseInt(process.env.CALLBACK_PORT, this._parseInt(process.env.PORT, 3000, 1, 65535), 1, 65535)
    });
  }

  /**
   * Get all configuration (untuk debugging/logging)
   * WARNING: Jangan log config ini di production karena contains sensitive data!
   * 
   * @returns {Object} All configuration (sanitized untuk sensitive data)
   */
  static getAll() {
    return {
      environment: this.environment,
      app: {
        ...this.app,
        adminChatId: this.app.adminChatId ? '***REDACTED***' : undefined
      },
      database: {
        ...this.database,
        url: this.database.url ? '***REDACTED***' : undefined
      },
      telegram: {
        ...this.telegram,
        token: this.telegram.token ? '***REDACTED***' : undefined,
        webhookSecret: this.telegram.webhookSecret ? '***REDACTED***' : undefined
      },
      payment: {
        sakurupiah: {
          ...this.payment.sakurupiah,
          apiKey: this.payment.sakurupiah.apiKey ? '***REDACTED***' : undefined,
          apiId: this.payment.sakurupiah.apiId ? '***REDACTED***' : undefined
        },
        callbackUrl: this.payment.callbackUrl,
        returnUrl: this.payment.returnUrl
      },
      gameProvider: {
        vipreseller: {
          ...this.gameProvider.vipreseller,
          apiKey: this.gameProvider.vipreseller.apiKey ? '***REDACTED***' : undefined,
          apiId: this.gameProvider.vipreseller.apiId ? '***REDACTED***' : undefined
        }
      },
      cloudflare: {
        ...this.cloudflare,
        token: this.cloudflare.token ? '***REDACTED***' : undefined
      },
      logging: this.logging,
      cache: this.cache,
      retry: this.retry,
      server: this.server
    };
  }
}
