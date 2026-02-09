/**
 * SessionRepositoryPort - Interface for Session data operations
 * 
 * This port defines the contract for Session repositories.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class SessionRepositoryPort {
    /**
     * Save or update session
     * @param {String} chatId
     * @param {Object} data - Session data
     * @returns {Promise<Object>}
     */
    async save(chatId, data) {
        throw new Error('SessionRepositoryPort.save() must be implemented');
    }

    /**
     * Get session by chatId
     * @param {String} chatId
     * @returns {Promise<Object|null>}
     */
    async get(chatId) {
        throw new Error('SessionRepositoryPort.get() must be implemented');
    }

    /**
     * Check if session exists
     * @param {String} chatId
     * @returns {Promise<Boolean>}
     */
    async exists(chatId) {
        throw new Error('SessionRepositoryPort.exists() must be implemented');
    }

    /**
     * Delete session by chatId
     * @param {String} chatId
     * @returns {Promise<Object>}
     */
    async delete(chatId) {
        throw new Error('SessionRepositoryPort.delete() must be implemented');
    }

    /**
     * Delete expired sessions
     * @param {Number} hoursOld - Delete sessions older than this
     * @returns {Promise<Object>}
     */
    async deleteExpired(hoursOld) {
        throw new Error('SessionRepositoryPort.deleteExpired() must be implemented');
    }
}
