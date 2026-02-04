/**
 * Message Entity
 * Represents a normalized message from Telegram
 * 
 * Used by:
 * - TelegramAdapter.parseUpdate() - creates Message objects
 * - HandleMessageUseCase - orchestrates message processing
 * - CommandHandlers - handles callback routing
 * - SessionInputHandler - handles user input during order flow
 */
export class Message {
    constructor({
        chatId,
        text = '',
        messageId,
        senderName = '',
        senderId,
        type = 'text',
        from = {},
        callbackData = null,
        callbackId = null
    }) {
        this.chatId = chatId;
        this.text = text;
        this.messageId = messageId;
        this.senderName = senderName;
        this.senderId = senderId;
        this.type = type;
        this.from = from;
        this.callbackData = callbackData;
        this.callbackId = callbackId;

        // Runtime: assigned after authentication by HandleMessageUseCase
        this.user = null;
    }

    /**
     * Check if message is a callback query (button click)
     */
    isCallback() {
        return this.type === 'callback';
    }

    /**
     * Check if message is a text message
     */
    isText() {
        return this.type === 'text';
    }
}
