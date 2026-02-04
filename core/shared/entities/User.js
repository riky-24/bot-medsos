/**
 * User Entity
 * Represents a Telegram user with authentication and authorization
 */
export class User {
  constructor({
    id,
    telegramId,
    chatId,
    username = null,
    firstName = '',
    lastName = '',
    isBot = false,
    languageCode = 'id',
    isActive = true,
    isBanned = false,
    role = 'user',
    createdAt = new Date(),
    lastActiveAt = new Date()
  }) {
    this.id = id;
    this.telegramId = telegramId;
    this.chatId = chatId;
    this.username = username;
    this.firstName = firstName;
    this.lastName = lastName;
    this.isBot = isBot;
    this.languageCode = languageCode;
    this.isActive = isActive;
    this.isBanned = isBanned;
    this.role = role;
    this.createdAt = createdAt;
    this.lastActiveAt = lastActiveAt;
  }

  /**
   * Get full name
   */
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim() || this.username || 'Unknown';
  }

  /**
   * Get display name (username or full name)
   */
  getDisplayName() {
    return this.username ? `@${this.username}` : this.getFullName();
  }

  /**
   * Validate user data
   */
  isValid() {
    return !!(this.id && this.chatId);
  }

  /**
   * Update last active timestamp
   */
  touch() {
    this.lastActiveAt = new Date();
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Check if user can access the system
   */
  canAccess() {
    return this.isActive && !this.isBanned;
  }
}

