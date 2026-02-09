/**
 * UserRepositoryPort - Interface for User data operations
 * 
 * This port defines the contract for User repositories.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class UserRepositoryPort {
    /**
     * Find user by Telegram ID
     * @param {String} telegramId
     * @returns {Promise<User|null>}
     */
    async findByTelegramId(telegramId) {
        throw new Error('UserRepositoryPort.findByTelegramId() must be implemented');
    }

    /**
     * Find user by Chat ID
     * @param {String} chatId
     * @returns {Promise<User|null>}
     */
    async findByChatId(chatId) {
        throw new Error('UserRepositoryPort.findByChatId() must be implemented');
    }

    /**
     * Find user by database ID
     * @param {String} id - UUID
     * @returns {Promise<User|null>}
     */
    async findById(id) {
        throw new Error('UserRepositoryPort.findById() must be implemented');
    }

    /**
     * Create new user
     * @param {Object} userData
     * @returns {Promise<User>}
     */
    async create(userData) {
        throw new Error('UserRepositoryPort.create() must be implemented');
    }

    /**
     * Update user
     * @param {String} id - User database ID
     * @param {Object} updates
     * @returns {Promise<User>}
     */
    async update(id, updates) {
        throw new Error('UserRepositoryPort.update() must be implemented');
    }

    /**
     * Ban user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async banUser(id) {
        throw new Error('UserRepositoryPort.banUser() must be implemented');
    }

    /**
     * Unban user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async unbanUser(id) {
        throw new Error('UserRepositoryPort.unbanUser() must be implemented');
    }

    /**
     * Deactivate user (soft delete)
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async deactivate(id) {
        throw new Error('UserRepositoryPort.deactivate() must be implemented');
    }

    /**
     * Activate user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async activate(id) {
        throw new Error('UserRepositoryPort.activate() must be implemented');
    }

    // ========================================
    // UserSession Operations
    // ========================================

    /**
     * Create or update user session
     * @param {Object} sessionData
     * @returns {Promise<UserSession>}
     */
    async upsertSession(sessionData) {
        throw new Error('UserRepositoryPort.upsertSession() must be implemented');
    }

    /**
     * Get user session by chatId
     * @param {String} chatId
     * @returns {Promise<UserSession|null>}
     */
    async getSession(chatId) {
        throw new Error('UserRepositoryPort.getSession() must be implemented');
    }

    /**
     * Delete session (logout)
     * @param {String} chatId
     */
    async deleteSession(chatId) {
        throw new Error('UserRepositoryPort.deleteSession() must be implemented');
    }

    /**
     * Cleanup expired sessions
     * @returns {Promise<Number>} Count of deleted sessions
     */
    async cleanupExpiredSessions() {
        throw new Error('UserRepositoryPort.cleanupExpiredSessions() must be implemented');
    }
}
