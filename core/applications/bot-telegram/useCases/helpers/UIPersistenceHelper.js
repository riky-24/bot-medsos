import logger from '../../../../shared/services/Logger.js';

/**
 * UIPersistenceHelper
 * Responsibility: Guarantee "1-Bubble Chat" experience.
 * Strategy: Edit if possible, Delete + Send if not.
 */
export class UIPersistenceHelper {
    constructor(sendPort, sessionService) {
        this.sendPort = sendPort;
        this.sessionService = sessionService;
    }

    /**
     * Send or Edit message with bubble persistence
     * @param {String} chatId 
     * @param {String} text 
     * @param {Object} options { reply_markup, parse_mode, forceNew }
     * @returns {Object} Telegram Response
     */
    async sendOrEdit(chatId, text, options = {}) {
        const lastMsgId = await this.sessionService.getLastMessageId(chatId);
        const parse_mode = options.parse_mode || 'Markdown';
        const reply_markup = this._cleanMarkup(options.reply_markup);

        // 1. If we have a message to edit and not forced to send new
        if (lastMsgId && !options.forceNew) {
            try {
                // If it's a text message, we can edit it
                const result = await this.sendPort.editMessageText(chatId, lastMsgId, text, {
                    ...(reply_markup && { reply_markup }),
                    parse_mode
                });
                return result;
            } catch (e) {
                // If edit fails (e.g. content same, or msg too old/missing, or it was a photo)
                if (e.message.includes('message is not modified')) {
                    return { success: true, message_id: lastMsgId };
                }
                logger.debug(`[UIHelper] Edit failed (${e.message}), falling back to Delete + Send`);

                // Cleanup old if it exists but can't be edited
                try { await this.sendPort.deleteMessage(chatId, lastMsgId); } catch (delErr) { }
            }
        }

        // 2. Clear old bubble if it's there but we are sending new
        if (lastMsgId && options.forceNew) {
            try { await this.sendPort.deleteMessage(chatId, lastMsgId); } catch (delErr) { }
        }

        // 3. Send New Message
        const response = await this.sendPort.sendMessage(chatId, text, {
            ...(reply_markup && { reply_markup }),
            parse_mode
        });

        // 4. Update track for next time
        if (response?.result?.message_id) {
            await this.sessionService.setLastMessageId(chatId, response.result.message_id);
        }

        return response;
    }

    /**
     * Send Photo with persistence (always deletes old bubble)
     */
    async sendPhoto(chatId, photoUrl, options = {}) {
        const lastMsgId = await this.sessionService.getLastMessageId(chatId);
        const reply_markup = this._cleanMarkup(options.reply_markup);

        // Photo always breaks 'edit' for text, so we delete + send
        if (lastMsgId) {
            try { await this.sendPort.deleteMessage(chatId, lastMsgId); } catch (e) { }
        }

        const response = await this.sendPort.sendPhoto(chatId, photoUrl, {
            caption: options.caption || '',
            parse_mode: options.parse_mode || 'Markdown',
            ...(reply_markup && { reply_markup })
        });

        if (response?.result?.message_id) {
            await this.sessionService.setLastMessageId(chatId, response.result.message_id);
        }

        return response;
    }

    /**
     * Delete user or system message quietly
     */
    async deleteSilently(chatId, messageId) {
        if (!messageId) return;
        try {
            await this.sendPort.deleteMessage(chatId, messageId);
        } catch (e) {
            logger.debug(`[UIHelper] Silent delete failed: ${e.message}`);
        }
    }

    /**
     * Smart Unwrap for reply_markup
     * Prevents { reply_markup: { reply_markup: ... } }
     */
    _cleanMarkup(markup) {
        if (!markup) return null;
        if (markup.reply_markup) return markup.reply_markup;
        return markup;
    }
}
