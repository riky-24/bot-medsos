/**
 * GameProviderPort - Interface for game provider operations
 * 
 * This port defines the contract for game provider adapters.
 * Any game provider (VIPReseller, DigiFlazz, etc.) must implement these methods.
 */
export class GameProviderPort {
  /**
   * Get available services/packages for a game
   * @param {String} gameCode - Game code (e.g., 'mobile-legends')
   * @returns {Promise<Array>} List of available packages
   */
  async getGameServices(gameCode) {
    throw new Error('GameProviderPort.getGameServices() must be implemented by adapter');
  }

  /**
   * Create a top-up order
   * @param {Object} orderData - Order details
   * @param {String} orderData.gameCode - Game code
   * @param {String} orderData.serviceId - Package/service ID
   * @param {String} orderData.playerId - Player ID
   * @param {String} orderData.zoneId - Zone/server ID (optional)
   * @returns {Promise<Object>} Order result
   */
  async orderTopUp(orderData) {
    throw new Error('GameProviderPort.orderTopUp() must be implemented by adapter');
  }

  /**
   * Check order status
   * @param {String} orderId - Order/transaction ID
   * @returns {Promise<Object>} Order status details
   */
  async checkOrderStatus(orderId) {
    throw new Error('GameProviderPort.checkOrderStatus() must be implemented by adapter');
  }

  /**
   * Get player information (validate player/get nickname)
   * @param {String} gameCode - Game code
   * @param {String} playerId - Player ID
   * @param {String} zoneId - Zone/server ID (optional)
   * @returns {Promise<Object>} Player information
   */
  async getPlayerInfo(gameCode, playerId, zoneId = null) {
    throw new Error('GameProviderPort.getPlayerInfo() must be implemented by adapter');
  }
}
