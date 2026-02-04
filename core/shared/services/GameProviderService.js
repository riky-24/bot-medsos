/**
 * GameProviderService - Core business logic for game provider operations
 * 
 * Coordinates game top-up fulfillment without knowing specific provider implementation.
 * Depends on GameProviderPort interface, allowing easy provider switching.
 * 
 * Dependencies are injected via constructor (Dependency Injection).
 */
import logger from './Logger.js';

export class GameProviderService {
  /**
   * @param {GameProviderPort} gameProviderPort - Game provider adapter
   */
  constructor(gameProviderPort) {
    this.providerPort = gameProviderPort;
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
      const result = await this.providerPort.orderTopUp(cleanData);
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
      const packages = await this.providerPort.getGameServices(cleanGameCode);
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
      const status = await this.providerPort.checkOrderStatus(orderId);
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
      const playerInfo = await this.providerPort.getPlayerInfo(cleanGameCode, cleanPlayerId, cleanZoneId);
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
