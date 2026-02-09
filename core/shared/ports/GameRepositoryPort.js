/**
 * GameRepositoryPort - Interface for Game data operations
 * 
 * This port defines the contract for Game repositories.
 * Handles Brand, GameService, and GameAccount entities.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class GameRepositoryPort {
    // ========================================
    // Brand Operations
    // ========================================

    /**
     * Get or create a brand by code
     * @param {Object} brandData - { code, name, categories, provider }
     * @returns {Promise<Object>}
     */
    async getOrCreateBrand(brandData) {
        throw new Error('GameRepositoryPort.getOrCreateBrand() must be implemented');
    }

    /**
     * Find brand by code
     * @param {String} code
     * @returns {Promise<Object|null>}
     */
    async findByCode(code) {
        throw new Error('GameRepositoryPort.findByCode() must be implemented');
    }

    /**
     * Get all brands
     * @returns {Promise<Array>}
     */
    async getAllBrands() {
        throw new Error('GameRepositoryPort.getAllBrands() must be implemented');
    }

    // ========================================
    // GameService Operations
    // ========================================

    /**
     * Sync game services for a brand
     * @param {String} brandId
     * @param {Array} servicesFromAPI
     * @returns {Promise<Array>}
     */
    async syncBrandServices(brandId, servicesFromAPI) {
        throw new Error('GameRepositoryPort.syncBrandServices() must be implemented');
    }

    /**
     * Get services for a brand
     * @param {String} brandCode
     * @returns {Promise<Array>}
     */
    async getBrandServices(brandCode) {
        throw new Error('GameRepositoryPort.getBrandServices() must be implemented');
    }

    /**
     * Get services for a brand by category
     * @param {String} brandCode
     * @param {String} category
     * @returns {Promise<Array>}
     */
    async getBrandServicesByCategory(brandCode, category) {
        throw new Error('GameRepositoryPort.getBrandServicesByCategory() must be implemented');
    }

    /**
     * Find service by code
     * @param {String} code
     * @returns {Promise<Object|null>}
     */
    async findServiceByCode(code) {
        throw new Error('GameRepositoryPort.findServiceByCode() must be implemented');
    }

    // ========================================
    // GameAccount Operations
    // ========================================

    /**
     * Save or update game account
     * @param {Object} accountData
     * @returns {Promise<Object>}
     */
    async saveGameAccount(accountData) {
        throw new Error('GameRepositoryPort.saveGameAccount() must be implemented');
    }

    /**
     * Get user's game accounts
     * @param {String} userId
     * @returns {Promise<Array>}
     */
    async getUserGameAccounts(userId) {
        throw new Error('GameRepositoryPort.getUserGameAccounts() must be implemented');
    }
}
