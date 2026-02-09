import { User } from '../entities/User.js';
import { UserSession } from '../value-objects/UserSession.js';
import { UserRepositoryPort } from '../ports/UserRepositoryPort.js';
import logger from '../services/Logger.js';

/**
 * UserRepository
 * Data access layer for User and UserSession entities
 * Implements UserRepositoryPort for Hexagonal Architecture
 */
export class UserRepository extends UserRepositoryPort {
    constructor(databasePort) {
        super();
        this.db = databasePort;
    }

    /**
     * Find user by Telegram ID
     * @param {String} telegramId
     * @returns {Promise<User|null>}
     */
    async findByTelegramId(telegramId) {
        try {
            const data = await this.db.client.user.findUnique({
                where: { telegramId: String(telegramId) }
            });
            return data ? this._toUserEntity(data) : null;
        } catch (error) {
            logger.error(`[UserRepo] Error finding user by telegramId: ${error.message}`);
            return null;
        }
    }

    /**
     * Find user by Chat ID
     * @param {String} chatId
     * @returns {Promise<User|null>}
     */
    async findByChatId(chatId) {
        try {
            const data = await this.db.client.user.findUnique({
                where: { chatId: String(chatId) }
            });
            return data ? this._toUserEntity(data) : null;
        } catch (error) {
            logger.error(`[UserRepo] Error finding user by chatId: ${error.message}`);
            return null;
        }
    }

    /**
     * Find user by database ID
     * @param {String} id - UUID
     * @returns {Promise<User|null>}
     */
    async findById(id) {
        try {
            const data = await this.db.client.user.findUnique({
                where: { id }
            });
            return data ? this._toUserEntity(data) : null;
        } catch (error) {
            logger.error(`[UserRepo] Error finding user by id: ${error.message}`);
            return null;
        }
    }

    /**
     * Create new user
     * @param {Object} userData
     * @returns {Promise<User>}
     */
    async create(userData) {
        try {
            const data = await this.db.client.user.create({
                data: {
                    telegramId: String(userData.telegramId),
                    chatId: String(userData.chatId),
                    username: userData.username || null,
                    firstName: userData.firstName || null,
                    lastName: userData.lastName || null,
                    languageCode: userData.languageCode || 'id',
                    isActive: userData.isActive !== undefined ? userData.isActive : true,
                    isBanned: userData.isBanned !== undefined ? userData.isBanned : false,
                    role: userData.role || 'user'
                }
            });
            logger.info(`[UserRepo] Created user: ${data.telegramId} (${data.id})`);
            return this._toUserEntity(data);
        } catch (error) {
            logger.error(`[UserRepo] Error creating user: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update user
     * @param {String} id - User database ID
     * @param {Object} updates
     * @returns {Promise<User>}
     */
    async update(id, updates) {
        try {
            const data = await this.db.client.user.update({
                where: { id },
                data: {
                    ...updates,
                    updatedAt: new Date()
                }
            });
            return this._toUserEntity(data);
        } catch (error) {
            logger.error(`[UserRepo] Error updating user ${id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Ban user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async banUser(id) {
        return await this.update(id, { isBanned: true });
    }

    /**
     * Unban user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async unbanUser(id) {
        return await this.update(id, { isBanned: false });
    }

    /**
     * Deactivate user (soft delete)
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async deactivate(id) {
        return await this.update(id, { isActive: false });
    }

    /**
     * Activate user
     * @param {String} id - User database ID
     * @returns {Promise<User>}
     */
    async activate(id) {
        return await this.update(id, { isActive: true });
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
        try {
            const data = await this.db.client.userSession.upsert({
                where: { chatId: String(sessionData.chatId) },
                create: {
                    userId: sessionData.userId,
                    chatId: String(sessionData.chatId),
                    isAuthenticated: sessionData.isAuthenticated !== undefined ? sessionData.isAuthenticated : true,
                    userAgent: sessionData.userAgent || null,
                    ipAddress: sessionData.ipAddress || null,
                    lastActivity: new Date(),
                    expiresAt: sessionData.expiresAt
                },
                update: {
                    lastActivity: new Date(),
                    expiresAt: sessionData.expiresAt,
                    isAuthenticated: sessionData.isAuthenticated !== undefined ? sessionData.isAuthenticated : true
                }
            });
            return this._toSessionEntity(data);
        } catch (error) {
            logger.error(`[UserRepo] Error upserting session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get user session by chatId
     * @param {String} chatId
     * @returns {Promise<UserSession|null>}
     */
    async getSession(chatId) {
        try {
            const data = await this.db.client.userSession.findUnique({
                where: { chatId: String(chatId) }
            });
            return data ? this._toSessionEntity(data) : null;
        } catch (error) {
            logger.error(`[UserRepo] Error getting session: ${error.message}`);
            return null;
        }
    }

    /**
     * Delete session (logout)
     * @param {String} chatId
     */
    async deleteSession(chatId) {
        try {
            await this.db.client.userSession.deleteMany({
                where: { chatId: String(chatId) }
            });
            logger.info(`[UserRepo] Deleted session for chatId: ${chatId}`);
        } catch (error) {
            logger.error(`[UserRepo] Error deleting session: ${error.message}`);
        }
    }

    /**
     * Cleanup expired sessions
     * @returns {Promise<Number>} Count of deleted sessions
     */
    async cleanupExpiredSessions() {
        try {
            const result = await this.db.client.userSession.deleteMany({
                where: {
                    expiresAt: { lt: new Date() }
                }
            });
            if (result.count > 0) {
                logger.info(`[UserRepo] Cleaned up ${result.count} expired user sessions`);
            }
            return result.count;
        } catch (error) {
            logger.error(`[UserRepo] Error cleaning up sessions: ${error.message}`);
            return 0;
        }
    }

    // ========================================
    // Entity Conversion Helpers
    // ========================================

    /**
     * Convert database row to User entity
     * @private
     */
    _toUserEntity(data) {
        return new User({
            id: data.id,
            telegramId: data.telegramId,
            chatId: data.chatId,
            username: data.username,
            firstName: data.firstName,
            lastName: data.lastName,
            languageCode: data.languageCode,
            isActive: data.isActive,
            isBanned: data.isBanned,
            role: data.role,
            createdAt: data.createdAt,
            lastActiveAt: data.lastActiveAt
        });
    }

    /**
     * Convert database row to UserSession entity
     * @private
     */
    _toSessionEntity(data) {
        return new UserSession({
            id: data.id,
            userId: data.userId,
            chatId: data.chatId,
            isAuthenticated: data.isAuthenticated,
            userAgent: data.userAgent,
            ipAddress: data.ipAddress,
            lastActivity: data.lastActivity,
            expiresAt: data.expiresAt,
            createdAt: data.createdAt
        });
    }
}
