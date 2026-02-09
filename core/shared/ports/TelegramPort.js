/**
 * TelegramPort - Interface for Telegram bot operations
 * 
 * This port defines the contract for Telegram adapters.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class TelegramPort {
    /**
     * Set webhook URL for receiving updates
     * @param {String} url - Webhook URL
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async setWebhook(url, options = {}) {
        throw new Error('TelegramPort.setWebhook() must be implemented');
    }

    /**
     * Delete current webhook
     * @returns {Promise<Object>}
     */
    async deleteWebhook() {
        throw new Error('TelegramPort.deleteWebhook() must be implemented');
    }

    /**
     * Send text message
     * @param {String|Number} chatId
     * @param {String} text
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async sendMessage(chatId, text, options = {}) {
        throw new Error('TelegramPort.sendMessage() must be implemented');
    }

    /**
     * Send photo message
     * @param {String|Number} chatId
     * @param {String} photo - URL or file_id
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async sendPhoto(chatId, photo, options = {}) {
        throw new Error('TelegramPort.sendPhoto() must be implemented');
    }

    /**
     * Edit message text
     * @param {String|Number} chatId
     * @param {Number} messageId
     * @param {String} text
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async editMessageText(chatId, messageId, text, options = {}) {
        throw new Error('TelegramPort.editMessageText() must be implemented');
    }

    /**
     * Edit message caption (for photo messages)
     * @param {String|Number} chatId
     * @param {Number} messageId
     * @param {String} caption
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async editMessageCaption(chatId, messageId, caption, options = {}) {
        throw new Error('TelegramPort.editMessageCaption() must be implemented');
    }

    /**
     * Answer callback query
     * @param {String} callbackQueryId
     * @param {String} text
     * @param {Boolean} showAlert
     * @returns {Promise<void>}
     */
    async answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
        throw new Error('TelegramPort.answerCallbackQuery() must be implemented');
    }

    /**
     * Delete a message
     * @param {String|Number} chatId
     * @param {Number} messageId
     * @returns {Promise<void>}
     */
    async deleteMessage(chatId, messageId) {
        throw new Error('TelegramPort.deleteMessage() must be implemented');
    }

    /**
     * Parse incoming update to Message entity
     * @param {Object} update - Raw Telegram update object
     * @returns {Message|null}
     */
    parseUpdate(update) {
        throw new Error('TelegramPort.parseUpdate() must be implemented');
    }
}
