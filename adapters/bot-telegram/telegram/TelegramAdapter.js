import https from "https";
import { Message } from "../../../core/shared/entities/Message.js";
import { TelegramPort } from "../../../core/shared/ports/TelegramPort.js";
import logger from "../../../core/shared/services/Logger.js";
import { Sanitizer } from "../../../core/shared/utils/Sanitizer.js";

/**
 * TelegramAdapter
 * Implements TelegramPort for Hexagonal Architecture
 */
export class TelegramAdapter extends TelegramPort {
  constructor(token) {
    super();
    this.token = token;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async setWebhook(url, options = {}) {
    logger.info(`[TelegramAdapter] Setting webhook to: ${url}`);
    const body = { url, ...options };
    return await this.request("setWebhook", "POST", body);
  }

  async deleteWebhook() {
    logger.info(`[TelegramAdapter] Deleting webhook...`);
    return await this.request("deleteWebhook", "POST");
  }

  request(path, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : null;
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload ? Buffer.byteLength(payload) : 0,
        },
      };

      const req = https.request(`${this.apiUrl}/${path}`, options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(body);
            if (response.ok) {
              resolve(response);
            } else {
              reject(new Error(`Telegram API Error: ${response.description} (${response.error_code})`));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async sendMessage(chatId, text, options = {}) {
    const body = { chat_id: chatId, text, ...options };
    return await this.request("sendMessage", "POST", body);
  }

  async sendPhoto(chatId, photo, options = {}) {
    const body = { chat_id: chatId, photo, ...options };
    return await this.request("sendPhoto", "POST", body);
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options
    };
    try {
      return await this.request("editMessageText", "POST", body);
    } catch (error) {
      if (error.message && error.message.includes("message is not modified")) {
        // Silently ignore this error as the desired state is already reached
        // Returning a mock success response to keep callers happy
        return { ok: true, result: true, description: "Message was not modified (suppressed error)" };
      }
      throw error;
    }
  }

  async editMessageCaption(chatId, messageId, caption, options = {}) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      caption,
      ...options
    };
    try {
      return await this.request("editMessageCaption", "POST", body);
    } catch (error) {
      if (error.message && error.message.includes("message is not modified")) {
        return { ok: true, result: true, description: "Caption was not modified" };
      }
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
    const body = {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    };
    await this.request("answerCallbackQuery", "POST", body);
  }

  async deleteMessage(chatId, messageId) {
    const body = { chat_id: chatId, message_id: messageId };
    await this.request("deleteMessage", "POST", body);
  }

  async setMyDescription(description) {
    const body = { description };
    return await this.request("setMyDescription", "POST", body);
  }

  async setMyShortDescription(shortDescription) {
    const body = { short_description: shortDescription };
    return await this.request("setMyShortDescription", "POST", body);
  }
  parseUpdate(u) {
    if (u.message && u.message.text) {
      logger.info(`[TelegramAdapter] Received text: ${u.message.text}`);

      // Sanitize User Input Fields (Mitigate CVE-2025-13068)
      const firstName = Sanitizer.sanitizeHTML(u.message.from.first_name);
      const lastName = Sanitizer.sanitizeHTML(u.message.from.last_name || '');
      const username = Sanitizer.sanitizeHTML(u.message.from.username || '');

      // Prefer first_name (Profile Name) over username
      const senderName = firstName || username || 'Kak';

      return new Message({
        chatId: u.message.chat.id,
        text: u.message.text,
        messageId: u.message.message_id,
        senderName,
        senderId: u.message.from.id,
        type: 'text',
        from: {
          id: u.message.from.id,
          username,
          firstName,
          lastName,
          languageCode: u.message.from.language_code
        }
      });
    } else if (u.callback_query) {
      logger.info(`[TelegramAdapter] Received callback: ${u.callback_query.data}`);
      const cb = u.callback_query;

      // Defensive check: cb.message can be undefined for old callbacks
      if (!cb.message) {
        logger.warn(`[TelegramAdapter] Callback query without message (may be too old)`);
        return null;
      }

      // Sanitize User Input Fields
      const firstName = Sanitizer.sanitizeHTML(cb.from.first_name);
      const lastName = Sanitizer.sanitizeHTML(cb.from.last_name || '');
      const username = Sanitizer.sanitizeHTML(cb.from.username || '');

      const senderName = firstName || username || 'Kak';

      return new Message({
        chatId: cb.message.chat.id,
        text: "",
        messageId: cb.message.message_id,
        senderName,
        senderId: cb.from.id,
        type: 'callback',
        callbackData: cb.data,
        callbackId: cb.id,
        from: {
          id: cb.from.id,
          username,
          firstName,
          lastName,
          languageCode: cb.from.language_code
        }
      });
    }
    return null;
  }
}
