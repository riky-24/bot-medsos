import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';

/**
 * SessionRepository
 * Encapsulates database operations for Session entity
 * Implements SessionRepositoryPort for Hexagonal Architecture
 */
export class SessionRepository extends SessionRepositoryPort {
  constructor(databasePort) {
    super();
    this.db = databasePort;
  }

  /**
   * Save or update session
   */
  async save(chatId, data) {
    // Ensure expiresAt has a default value (required field now)
    const expiresAt = data.expiresAt || (() => {
      const date = new Date();
      date.setHours(date.getHours() + (24 * 7)); // 7 days default
      return date;
    })();

    // Ensure userId has a default if creating new session
    const userId = data.userId || data.userUuid;

    return await this.db.client.session.upsert({
      where: { chatId: String(chatId) },
      update: data,
      create: {
        chatId: String(chatId),
        ...data,
        expiresAt,  // Always provide expiresAt for create
        userId: userId || 'temp-user-id',  // Temporary fallback if no auth yet
        isAuthenticated: data.isAuthenticated !== undefined ? data.isAuthenticated : false
      }
    });
  }

  /**
   * Get session by chatId
   */
  async get(chatId) {
    return await this.db.client.session.findUnique({
      where: { chatId: String(chatId) }
    });
  }

  /**
   * Check if session exists (lighter than get)
   */
  async exists(chatId) {
    const count = await this.db.client.session.count({
      where: { chatId: String(chatId) }
    });
    return count > 0;
  }

  /**
   * Delete session by chatId
   */
  async delete(chatId) {
    return await this.db.client.session.deleteMany({
      where: { chatId: String(chatId) }
    });
  }

  /**
   * Delete expired sessions (older than specified hours)
   * @param {number} hoursOld - Delete sessions older than this (default 24 hours)
   */
  async deleteExpired(hoursOld = 24) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - hoursOld);

    return await this.db.client.session.deleteMany({
      where: {
        updatedAt: { lt: expiryDate }
      }
    });
  }
}
