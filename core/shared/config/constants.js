// ===========================================
// CONSTANTS - Bot Medsos Configuration
// ===========================================

// Rate Limiting
export const RATE_LIMIT_MS = 1000; // 1000ms between requests (prevent accidental double click)

// ===========================================
// DATABASE
// ===========================================
export const DATABASE = {
  CONNECTION_LIMIT: 20,
  POOL_TIMEOUT: 10,      // seconds
  CONNECT_TIMEOUT: 5     // seconds
};

// ===========================================
// SERVER
// ===========================================
export const SERVER = {
  CALLBACK_PORT: 3000,
  HEALTH_CHECK_PORT: 3001
};

// ===========================================
// HTTP STATUS CODES
// ===========================================
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

// ===========================================
// PAYMENT STATUS
// ===========================================
export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  PENDING: 'PENDING'
};

// ===========================================
// QR CODE CONFIGURATION
// ===========================================
export const QR_CODE = {
  SIZE: 300,
  API_URL: 'https://quickchart.io/qr?text=',
  ERROR_CORRECTION: 'M'
};

// ===========================================
// CACHE
// ===========================================
export const CACHE = {
  TTL: 3600,           // 1 hour in seconds
  PAYMENT_CHANNELS: 86400  // 24 hours
};

// ===========================================
// TIMEOUTS
// ===========================================
export const TIMEOUTS = {
  API_TIMEOUT_MS: 15000,      // Default API timeout (15 seconds)
  SHORT_TIMEOUT_MS: 5000,     // Short timeout for quick operations (5 seconds)
  LONG_TIMEOUT_MS: 30000      // Long timeout for heavy operations (30 seconds)
};

// ===========================================
// RETRY
// ===========================================
export const RETRY = {
  MAX_RETRIES: 3,
  DELAY_MS: 1000
};

// ===========================================
// MESSAGE TEMPLATES
// ===========================================
export const MESSAGES = {
  WELCOME: '👋 Selamat datang di Bot Top Up Game!',
  ERROR: '❌ Terjadi kesalahan, silakan coba lagi',
  SUCCESS: '✅ Berhasil!',
  PAYMENT_PENDING: '⏳ Menunggu pembayaran...',
  PAYMENT_SUCCESS: '✅ Pembayaran berhasil!',
  PAYMENT_EXPIRED: '⏰ Pembayaran expired',
  INVALID_INPUT: '⚠️ Input tidak valid'
};

// ===========================================
// PRICING (Legacy - use database instead)
// ===========================================
export const PRICING = {
  ML_100_DIAMOND: 15000,
  ML_200_DIAMOND: 30000,
  ML_500_DIAMOND: 75000,
  FF_100_DIAMOND: 15000,
  FF_500_DIAMOND: 70000,
  PUBG_100_UC: 15000,
  PUBG_325_UC: 45000
};
