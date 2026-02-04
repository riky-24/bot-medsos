/**
 * Config Container
 * Centralized configuration for dependency injection
 * Exports all config objects in one container
 */
import { PRICING, QR_CODE, RATE_LIMIT_MS, SERVER, MESSAGES as CORE_MESSAGES } from './constants.js';
import { GAME_NORMALIZATION_RULES, normalizeGameName, getGameConfigMap } from './gameNormalization.js';

/**
 * Create config container for dependency injection
 * @returns {Object} Config object with all configuration
 */
export const createConfig = () => ({
  // Messages (Generic Core Messages)
  messages: CORE_MESSAGES,
  
  // Menus (Empty in Core, injected by App Layer)
  menus: {},
  
  // Constants (pricing, QR codes, limits)
  constants: {
    pricing: PRICING,
    qrCode: QR_CODE,
    rateLimit: RATE_LIMIT_MS,
    callbackPort: SERVER.CALLBACK_PORT
  },
  
  // Game mappings and helpers
  games: {
    mapping: getGameConfigMap(),
    getAllCodes: () => GAME_NORMALIZATION_RULES.map(r => r.targetCode),
    getInfo: (code) => getGameConfigMap()[code],
    getBrands: () => [...new Set(GAME_NORMALIZATION_RULES.map(r => r.brand))],
    normalizationRules: GAME_NORMALIZATION_RULES
  }
});

// Export individual configs for backward compatibility
export { PRICING, QR_CODE, RATE_LIMIT_MS, GAME_NORMALIZATION_RULES };
