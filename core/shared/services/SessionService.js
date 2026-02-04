/**
 * SessionService
 * Responsibility: Manage temporary user state (in-memory)
 */
import logger from './Logger.js';

export class SessionService {
  constructor(sessionRepository) {
    this.sessionRepo = sessionRepository;
  }

  /**
   * Save pending order details
   * @param {String} chatId 
   * @param {Object} data - { game, item, price, code, userId?, zoneId? }
   */
  async savePendingOrder(chatId, data) {
    try {
      await this.sessionRepo.save(chatId, {
        game: data.game || null,
        item: data.item || null,
        price: data.price || null,
        serviceCode: data.serviceCode || data.code || null,  // NEW field name
        gamePlayerId: data.gamePlayerId || data.userId || null,  // NEW field name
        zoneId: data.zoneId || null,
        amount: data.amount || null,
        channel: data.channelCode || data.channel || null,
        lastMsgId: data.lastMsgId || null,
        nickname: data.nickname || null,
        // Auth fields (if provided)
        userId: data.userUuid || data.userId || undefined,
        isAuthenticated: data.isAuthenticated === undefined ? undefined : data.isAuthenticated,
        lastActivity: data.lastActivity || undefined,
        expiresAt: data.expiresAt || undefined
      });
      logger.info(`[SessionService] Saved session for ${chatId}`);
    } catch (error) {
      logger.error(`[SessionService] Error saving session:`, error);
    }
  }

  /**
   * Specifically update only the last message ID
   */
  async setLastMessageId(chatId, messageId) {
    try {
      await this.sessionRepo.save(chatId, {
        lastMsgId: parseInt(messageId)
      });
      logger.debug(`[SessionService] Updated lastMsgId for ${chatId}: ${messageId}`);
    } catch (error) {
      logger.error(`[SessionService] Error setting lastMsgId:`, error);
    }
  }

  /**
   * Get UI persistence ID
   */
  async getLastMessageId(chatId) {
    const session = await this.getPendingOrder(chatId);
    return session?.lastMsgId || null;
  }

  /**
   * Get pending order details
   * @param {String} chatId 
   * @returns {Object|null}
   */
  async getPendingOrder(chatId) {
    try {
      const session = await this.sessionRepo.get(chatId);
      return session;
    } catch (error) {
      logger.error(`[SessionService] Error getting session:`, error);
      return null;
    }
  }

  /**
   * Clear session
   * @param {String} chatId 
   */
  async clearSession(chatId) {
    try {
      await this.sessionRepo.delete(chatId);
      logger.info(`[SessionService] Cleared session for ${chatId}`);
    } catch (error) {
      logger.error(`[SessionService] Error clearing session:`, error);
    }
  }

  /**
   * Cleanup expired sessions from database
   * @param {number} hoursOld 
   */
  async cleanupExpiredSessions(hoursOld = 24) {
    try {
      const result = await this.sessionRepo.deleteExpired(hoursOld);
      if (result.count > 0) {
        logger.info(`[SessionService] Cleaned up ${result.count} expired sessions`);
      }
      return result;
    } catch (error) {
      logger.error(`[SessionService] Error during session cleanup:`, error);
      return { count: 0 };
    }
  }

  /**
   * Authenticate user and create/update session
   * @param {String} chatId
   * @param {String} userId - User.id (UUID)
   */
  async authenticate(chatId, userId) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (24 * 7)); // 7 days

    await this.sessionRepo.save(chatId, {
      userId,
      isAuthenticated: true,
      lastActivity: new Date(),
      expiresAt
    });
    logger.info(`[SessionService] Authenticated session for ${chatId}`);
  }

  /**
   * Check if session is authenticated and not expired
   * @param {String} chatId
   * @returns {Boolean}
   */
  async isAuthenticated(chatId) {
    try {
      const session = await this.getPendingOrder(chatId);
      if (!session || !session.isAuthenticated) return false;
      if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
        return false;
      }
      return true;
    } catch (error) {
      logger.error(`[SessionService] Error checking auth:`, error);
      return false;
    }
  }

  /**
   * Refresh last activity timestamp
 * @param {String} chatId
   */
  async refreshActivity(chatId) {
    try {
      await this.sessionRepo.save(chatId, {
        lastActivity: new Date()
      });
    } catch (error) {
      logger.debug(`[SessionService] Error refreshing activity:`, error);
    }
  }
}
