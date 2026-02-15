/**
 * GameProviderService - Core business logic for game provider operations
 * 
 * Coordinates game top-up fulfillment without knowing specific provider implementation.
 * Depends on GameProviderPort interface, allowing easy provider switching.
 * 
 * Dependencies are injected via constructor (Dependency Injection).
 */
import logger from './Logger.js';
import { TIMEOUTS } from '../config/constants.js';

export class GameProviderService {
  /**
   * @param {GameProviderPort} gameProviderPort - Game provider adapter
   */
  constructor(gameProviderPort) {
    this.providerPort = gameProviderPort;
  }

  /**
   * Helper to wrap promise with timeout
   */
  async _withTimeout(promise, context) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`API Timeout: ${context}`)), TIMEOUTS.API_TIMEOUT_MS);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Sanitize player ID input
   * Removes potentially harmful characters
   */
  _sanitizeInput(input) {
    if (!input) return '';
    // Allow alphanumeric, dashes, underscores, and spaces (common in game IDs)
    return String(input).replace(/[^a-zA-Z0-9\-_ ]/g, '').trim();
  }

  /**
   * Create game top-up order
   */
  async createOrder(orderData) {
    // Sanitize inputs
    const cleanData = {
      ...orderData,
      playerId: this._sanitizeInput(orderData.playerId),
      zoneId: orderData.zoneId ? this._sanitizeInput(orderData.zoneId) : null
    };

    logger.info('[GameProviderService] Creating order:', cleanData);

    try {
      // Wrap with timeout
      const result = await this._withTimeout(
        this.providerPort.orderTopUp(cleanData),
        `Create Order ${cleanData.gameCode}`
      );
      return result;
    } catch (error) {
      logger.error('[GameProviderService] Order error:', error);
      return {
        success: false,
        message: 'Failed to create order',
        error: error.message
      };
    }
  }

  /**
   * Get available packages for a game
   */
  async getAvailablePackages(gameCode) {
    const cleanGameCode = this._sanitizeInput(gameCode);
    logger.info(`[GameProviderService] Fetching packages for: ${cleanGameCode}`);

    try {
      const packages = await this._withTimeout(
        this.providerPort.getGameServices(cleanGameCode),
        `Get Packages ${cleanGameCode}`
      );
      return packages;
    } catch (error) {
      logger.error('[GameProviderService] Fetch packages error:', error);
      return [];
    }
  }

  /**
   * Check order status
   */
  async checkOrderStatus(orderId) {
    logger.info(`[GameProviderService] Checking status for: ${orderId}`);

    try {
      const status = await this._withTimeout(
        this.providerPort.checkOrderStatus(orderId),
        `Check Status ${orderId}`
      );
      return status;
    } catch (error) {
      logger.error('[GameProviderService] Status check error:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Validate player/account (get nickname)
   */
  async validatePlayer(gameCode, playerId, zoneId = null) {
    const cleanGameCode = this._sanitizeInput(gameCode);
    const cleanPlayerId = this._sanitizeInput(playerId);
    const cleanZoneId = zoneId ? this._sanitizeInput(zoneId) : null;

    logger.info('[GameProviderService] Validating player:', {
      gameCode: cleanGameCode,
      playerId: cleanPlayerId,
      zoneId: cleanZoneId
    });

    try {
      const playerInfo = await this._withTimeout(
        this.providerPort.getPlayerInfo(cleanGameCode, cleanPlayerId, cleanZoneId),
        `Validate Player ${cleanGameCode}`
      );
      return playerInfo;
    } catch (error) {
      logger.error('[GameProviderService] Player validation error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
