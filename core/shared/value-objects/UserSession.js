/**
 * UserSession Value Object
 * Represents authenticated session state
 */
export class UserSession {
    constructor({
        id,
        userId,
        chatId,
        isAuthenticated = true,
        userAgent = null,
        ipAddress = null,
        lastActivity = new Date(),
        expiresAt,
        createdAt = new Date()
    }) {
        this.id = id;
        this.userId = userId;
        this.chatId = chatId;
        this.isAuthenticated = isAuthenticated;
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
        this.lastActivity = lastActivity;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    /**
     * Check if session has expired
     * @returns {Boolean}
     */
    isExpired() {
        return new Date() > new Date(this.expiresAt);
    }

    /**
     * Check if session is valid (authenticated and not expired)
     * @returns {Boolean}
     */
    isValid() {
        return this.isAuthenticated && !this.isExpired();
    }

    /**
     * Get time remaining before expiry (in hours)
     * @returns {Number}
     */
    getTimeRemaining() {
        const now = new Date();
        const expiry = new Date(this.expiresAt);
        const diff = expiry - now;
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    }
}
