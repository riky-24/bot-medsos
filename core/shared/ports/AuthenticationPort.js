/**
 * AuthenticationPort
 * Interface for Authentication adapters.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class AuthenticationPort {
    /**
     * Authenticate user dan create/update session
     * Auto-registers new users if they don't exist
     * 
     * @param {Object} credentials - { telegramId, chatId, username, firstName, lastName, languageCode }
     * @returns {Promise<User>} Authenticated user entity
     * @throws {Error} If user is banned or authentication fails
     */
    async authenticate(credentials) {
        throw new Error('AuthenticationPort.authenticate() must be implemented');
    }

    /**
     * Get current authenticated user by chatId
     * 
     * @param {String} chatId - Telegram chat ID
     * @returns {Promise<User|null>} User entity if authenticated and active, null otherwise
     */
    async getCurrentUser(chatId) {
        throw new Error('AuthenticationPort.getCurrentUser() must be implemented');
    }

    /**
     * Logout user (invalidate session)
     * 
     * @param {String} chatId - Telegram chat ID
     * @returns {Promise<void>}
     */
    async logout(chatId) {
        throw new Error('AuthenticationPort.logout() must be implemented');
    }

    /**
     * Refresh session expiry and update last activity
     * 
     * @param {String} chatId - Telegram chat ID
     * @returns {Promise<void>}
     */
    async refreshSession(chatId) {
        throw new Error('AuthenticationPort.refreshSession() must be implemented');
    }

    /**
     * Check if session is valid and not expired
     * 
     * @param {String} chatId - Telegram chat ID
     * @returns {Promise<Boolean>} True if session exists and is valid
     */
    async hasValidSession(chatId) {
        throw new Error('AuthenticationPort.hasValidSession() must be implemented');
    }
}
