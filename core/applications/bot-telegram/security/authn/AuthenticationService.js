import { AuthenticationPort } from '../../../../shared/ports/AuthenticationPort.js';
import logger from '../../../../shared/services/Logger.js';

/**
 * AuthenticationService
 * Session-based authentication implementation for Telegram bots.
 * 
 * Features:
 * - Auto-registration of new users
 * - Session management with expiry
 * - Integration with existing SessionService for shopping cart state
 */
export class AuthenticationService extends AuthenticationPort {
    constructor(userRepository, sessionService, config = {}) {
        super();
        this.userRepo = userRepository;
        this.sessionService = sessionService;

        // Configuration
        this.SESSION_DURATION_HOURS = config.sessionDurationHours || (24 * 7); // 7 days default
    }

    /**
     * Authenticate Telegram user (auto-register if new)
     * 
     * @param {Object} credentials - { telegramId, chatId, username, firstName, lastName, languageCode }
     * @returns {Promise<User>} Authenticated user
     * @throws {Error} If user is banned or inactive
     */
    async authenticate(credentials) {
        const { telegramId, chatId, username, firstName, lastName, languageCode } = credentials;

        try {
            // 1. Find existing user or create new one
            let user = await this.userRepo.findByTelegramId(telegramId);

            if (!user) {
                // Auto-register new user
                user = await this.userRepo.create({
                    telegramId,
                    chatId,
                    username,
                    firstName,
                    lastName,
                    languageCode: languageCode || 'id'
                });
                logger.info(`[AuthN] ✨ New user registered: ${telegramId} (${username || firstName})`);
            } else {
                // Update existing user info (chat ID might change, username might change)
                user = await this.userRepo.update(user.id, {
                    chatId,
                    username,
                    firstName,
                    lastName,
                    lastActiveAt: new Date()
                });
                logger.debug(`[AuthN] User info updated: ${telegramId}`);
            }

            // 2. Check if user can access
            if (!user.canAccess()) {
                const reason = user.isBanned ? 'banned' : 'inactive';
                logger.warn(`[AuthN] ⛔ Authentication denied for ${telegramId}: ${reason}`);
                throw new Error(`User is ${reason}`);
            }

            // 3. Create or refresh session
            await this._createOrRefreshSession(user);

            logger.info(`[AuthN] ✓ User authenticated: ${telegramId}`);
            return user;

        } catch (error) {
            if (error.message.includes('banned') || error.message.includes('inactive')) {
                throw error; // Re-throw authorization errors
            }
            logger.error(`[AuthN] Authentication error: ${error.message}`);
            throw new Error('Authentication failed');
        }
    }

    /**
     * Get current authenticated user by chatId
     * 
     * @param {String} chatId
     * @returns {Promise<User|null>}
     */
    async getCurrentUser(chatId) {
        try {
            // Check if user session exists and is valid
            const userSession = await this.userRepo.getSession(chatId);

            if (!userSession || !userSession.isValid()) {
                return null;
            }

            // Get full user details
            const user = await this.userRepo.findByChatId(chatId);

            if (!user || !user.canAccess()) {
                return null;
            }

            return user;

        } catch (error) {
            logger.error(`[AuthN] Error getting current user: ${error.message}`);
            return null;
        }
    }

    /**
     * Logout user (destroy session)
     * 
     * @param {Message} message
     * @returns {Promise<{success: Boolean}>}
     */
    async logout(message) {
        try {
            const chatId = message.chatId;

            // Clear session (includes auth state)
            await this.sessionService.clearSession(chatId);

            logger.info(`[AuthN] User logged out: ${chatId}`);
            return { success: true };

        } catch (error) {
            logger.error(`[AuthN] Logout error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    /**
     * Refresh session expiry and update last activity
     * 
     * @param {String} chatId
     */
    async refreshSession(chatId) {
        try {
            const user = await this.getCurrentUser(chatId);

            if (user) {
                await this._createOrRefreshSession(user);
                logger.debug(`[AuthN] Session refreshed for: ${chatId}`);
            }
        } catch (error) {
            logger.error(`[AuthN] Session refresh error: ${error.message}`);
        }
    }

    /**
     * Check if session is valid
     * 
     * @param {String} chatId
     * @returns {Promise<Boolean>}
     */
    async hasValidSession(chatId) {
        try {
            const userSession = await this.userRepo.getSession(chatId);
            return userSession ? userSession.isValid() : false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Cleanup expired sessions (background task)
     * Should be called periodically
     * 
     * @returns {Promise<Number>} Count of cleaned sessions
     */
    async cleanupExpiredSessions() {
        try {
            const count = await this.userRepo.cleanupExpiredSessions();
            if (count > 0) {
                logger.info(`[AuthN] 🧹 Cleaned up ${count} expired sessions`);
            }
            return count;
        } catch (error) {
            logger.error(`[AuthN] Cleanup error: ${error.message}`);
            return 0;
        }
    }

    // ========================================
    // Private Helpers
    // ========================================

    /**
     * Create or refresh user session (consolidated approach)
     * Uses SessionService to manage both auth state and shopping cart
     * 
     * @private
     * @param {User} user
     */
    async _createOrRefreshSession(user) {
        try {
            // Use SessionService to handle authentication
            await this.sessionService.authenticate(user.chatId, user.id);

            logger.debug(`[AuthN] Session created/refreshed for chatId: ${user.chatId}, userId: ${user.id}`);

        } catch (error) {
            logger.error(`[AuthN] Error creating session: ${error.message}`);
            throw error;
        }
    }
}
