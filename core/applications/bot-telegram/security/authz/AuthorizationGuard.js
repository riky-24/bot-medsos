import { PERMISSIONS } from './permissions.js';
import logger from '../../../../shared/services/Logger.js';
import { AuthorizationPort } from '../../../../shared/ports/AuthorizationPort.js';

/**
 * AuthorizationGuard (Adapter Implementation)
 * Implements AuthorizationPort with optional database backing.
 * 
 * @param {UserRepository} userRepository - Optional repository for DB-backed checks
 */
export class AuthorizationGuard extends AuthorizationPort {
    constructor(userRepository = null) {
        super();
        this.userRepo = userRepository;
        this.bannedUsers = new Set(); // Fallback: in-memory ban list
    }

    /**
     * Cek apakah user memiliki akses
     * @param {Object} context - User context (profile, id, etc)
     * @param {string} permission - Permission yang diminta
     * @param {Object} resource - Resource yang mau diakses (optional, for ownership check)
     * @returns {Promise<boolean>}
     */
    async can(userContext, permission, resource = null) {
        if (!userContext || !userContext.id) return false;

        // If database-backed, get full user from DB
        let user = null;
        if (this.userRepo) {
            try {
                user = await this._getUser(userContext);
                if (!user) return false;
            } catch (error) {
                logger.error(`[AUTHZ] Error fetching user: ${error.message}`);
                return false;
            }
        }

        // 1. Cek Global Ban
        const userId = userContext.id;
        const isBanned = this.userRepo
            ? (user && user.isBanned)  // DB check
            : this.isBanned(userId);    // In-memory check

        if (isBanned) {
            logger.warn(`[AUTHZ_BAN] Blocked access from banned user | User: ${userId} | Permission: ${permission}`);
            return false;
        }

        // 1.5. Check if user is active (DB only)
        if (user && !user.isActive) {
            logger.warn(`[AUTHZ_INACTIVE] Blocked inactive user | User: ${userId}`);
            return false;
        }

        // 2. Resource Ownership Check
        if (resource && resource.ownerId) {
            if (resource.ownerId !== userId) {
                // Admin bypass (if user has role)
                if (user && user.role === 'admin') return true;

                logger.warn(`[AUTHZ_IDOR] Resource ownership mismatch | User: ${userId} | Owner: ${resource.ownerId} | ResourceId: ${resource.id || 'N/A'}`);
                return false;
            }
        }

        // 3. Permission Logic
        // Admin has all permissions
        if (user && user.role === 'admin') return true;

        // Standard users have basic permissions
        return true;
    }

    /**
     * Get user from database (helper)
     * @private
     */
    async _getUser(context) {
        if (!this.userRepo) return null;

        // Try chatId first (most common)
        if (context.chatId) {
            return await this.userRepo.findByChatId(context.chatId);
        }

        // Fallback to telegramId
        if (context.id) {
            return await this.userRepo.findByTelegramId(context.id);
        }

        return null;
    }

    /**
     * Block user (database-backed if available)
     */
    async banUser(identifier) {
        if (this.userRepo) {
            const user = await this._getUser({ id: identifier });
            if (user) {
                await this.userRepo.banUser(user.id);
                logger.info(`[AUTHZ] Banned user: ${identifier}`);
            }
        } else {
            this.bannedUsers.add(identifier);
        }
    }

    /**
     * Unblock user (database-backed if available)
     */
    async unbanUser(identifier) {
        if (this.userRepo) {
            const user = await this._getUser({ id: identifier });
            if (user) {
                await this.userRepo.unbanUser(user.id);
                logger.info(`[AUTHZ] Unbanned user: ${identifier}`);
            }
        } else {
            this.bannedUsers.delete(identifier);
        }
    }

    /**
     * Check if user is banned (database-backed if available)
     */
    async isBanned(identifier) {
        if (this.userRepo) {
            const user = await this._getUser({ id: identifier });
            return user ? user.isBanned : false;
        }
        return this.bannedUsers.has(identifier);
    }
}


