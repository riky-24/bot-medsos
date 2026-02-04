/**
 * AuthorizationPort
 * Interface contract for Authorization Adapters.
 * Following Hexagonal Architecture principle: Core logic depends on this Port, not concrete implementations.
 */
export class AuthorizationPort {
    /**
     * Check if user is authorized for action
     * @param {Object} user - User context (must have id)
     * @param {String} permission - Permission string
     * @param {Object} resource - Resource object (optional)
     * @returns {Promise<Boolean>}
     */
    async can(user, permission, resource = null) {
        throw new Error('AuthorizationPort.can() must be implemented');
    }

    /**
     * Ban a user
     * @param {String} userId 
     */
    banUser(userId) {
        throw new Error('AuthorizationPort.banUser() must be implemented');
    }

    /**
     * Unban a user
     * @param {String} userId 
     */
    unbanUser(userId) {
        throw new Error('AuthorizationPort.unbanUser() must be implemented');
    }

    /**
     * Check if user is banned
     * @param {String} userId 
     * @returns {Boolean}
     */
    isBanned(userId) {
        throw new Error('AuthorizationPort.isBanned() must be implemented');
    }
}
