/**
 * @file BaseHandler.js
 * @description Base class for all handlers providing common UI and dependency management
 * @responsibility Centralize UI initialization, error handling, and common utilities
 * 
 * @requires UIPersistenceHelper - Single bubble UI experience (lazy loaded)
 * @requires Logger - Logging service
 * 
 * @architecture Hexagonal Architecture - Application Layer Base Class
 * @pattern Template Method Pattern - Provides common structure for handlers
 * 
 * @example
 * class MyRouter extends BaseHandler {
 *   constructor(deps, config) {
 *     super(deps, config);
 *     this.myService = deps.myService;
 *   }
 *   
 *   async route(action, chatId, messageId) {
 *     await this.ensureUI();
 *     await this.sendOrEdit(chatId, messageId, 'Hello!');
 *   }
 * }
 * 
 * @features
 * - Lazy UI initialization (dynamic import)
 * - Common sendOrEdit wrapper
 * - Centralized error handling
 * - Shared dependency injection pattern
 * 
 * @related
 * - ActionRouter.js - Extends BaseHandler
 * - GuideRouter.js - Extends BaseHandler
 * - MenuRouter.js - Extends BaseHandler
 * - PaymentChannelHandler.js - Extends BaseHandler
 */
import logger from '../../../../shared/services/Logger.js';

export class BaseHandler {
    /**
     * Constructor for BaseHandler
     * @param {Object} deps - Dependency injection object
     * @param {Object} deps.sendPort - Telegram messaging port
     * @param {Object} deps.sessionService - Session management service
     * @param {Object} deps.ui - Optional pre-initialized UI helper
     * @param {Object} config - Configuration object
     * @param {Object} config.messages - Message templates
     */
    constructor(deps, config) {
        // Core dependencies available to all handlers
        this.sendPort = deps.sendPort;
        this.sessionService = deps.sessionService;
        this.messages = config?.messages || {};

        // UI helper (lazy loaded if not provided)
        this.ui = deps.ui || null;

        // Track initialization state
        this._uiInitialized = !!deps.ui;
    }

    /**
     * Ensure UI helper is initialized
     * Uses dynamic import for lazy loading
     * @protected
     */
    async ensureUI() {
        if (!this.ui) {
            try {
                const { UIPersistenceHelper } = await import('../helpers/UIPersistenceHelper.js');
                this.ui = new UIPersistenceHelper(this.sendPort, this.sessionService);
                this._uiInitialized = true;
                logger.debug(`[${this.constructor.name}] UI helper initialized via dynamic import`);
            } catch (error) {
                logger.error(`[${this.constructor.name}] Failed to load UI helper:`, error);
                throw new Error('UI helper initialization failed');
            }
        }
    }

    /**
     * Send or edit message with UI persistence
     * Automatically initializes UI if needed
     * @param {String} chatId - Chat identifier
     * @param {String} text - Message text (Markdown)
     * @param {Object} options - Send options
     * @param {Object} options.reply_markup - Keyboard markup
     * @param {Boolean} options.forceNew - Force new message instead of edit
     * @param {Boolean} options.deleteOnly - Only delete message
     * @param {String} options.parse_mode - Parse mode (default: Markdown)
     * @returns {Promise<Object>} Message result
     */
    async sendOrEdit(chatId, text, options = {}) {
        await this.ensureUI();

        // Handle delete-only mode
        if (options.deleteOnly && options.messageId) {
            return await this.ui.deleteSilently(chatId, options.messageId);
        }

        return await this.ui.sendOrEdit(chatId, text, {
            reply_markup: options.reply_markup || null,
            parse_mode: options.parse_mode || 'Markdown',
            forceNew: options.forceNew || false,
            disable_web_page_preview: options.disable_web_page_preview !== undefined
                ? options.disable_web_page_preview
                : false
        });
    }

    /**
     * Send error message to user
     * @param {String} chatId - Chat identifier
     * @param {String} errorKey - Error message key or direct message
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Message result
     */
    async sendError(chatId, errorKey, options = {}) {
        await this.ensureUI();

        const errorMessage = this.messages[errorKey] || this.messages.ERROR?.(errorKey) || errorKey;

        return await this.sendOrEdit(chatId, errorMessage, {
            ...options,
            reply_markup: options.reply_markup || {
                inline_keyboard: [[
                    { text: this.messages.BUTTON_BACK_TO_MENU || '🔙 Menu Utama', callback_data: 'menu_main' }
                ]]
            }
        });
    }

    /**
     * Log and send error to user
     * Combines error logging with user notification
     * @param {String} context - Log context (e.g., method name)
     * @param {Error} error - Error object
     * @param {String} chatId - Chat identifier
     * @param {String} userMessage - User-facing error message
     */
    async logAndSendError(context, error, chatId, userMessage = null) {
        logger.error(`[${this.constructor.name}] ${context}:`, {
            error: error.message,
            stack: error.stack,
            chatId
        });

        const message = userMessage || this.messages.ERR_GENERIC || 'Terjadi kesalahan. Silakan coba lagi.';
        await this.sendError(chatId, message);
    }

    /**
     * Log successful operation with structured data
     * Provides consistent success logging across all handlers
     * @param {string} operation - Operation name (e.g., 'Payment Processed', 'Order Confirmed')
     * @param {Object} data - Operation data
     * @param {string} data.chatId - Chat ID
     * @param {Object} [data.details] - Additional details
     */
    logSuccess(operation, data = {}) {
        const { chatId, ...details } = data;

        logger.info(`[${this.constructor.name}] ✅ ${operation}`, {
            chatId,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    /**
     * Validate required dependencies
     * Throws error if required service is missing
     * @param {Object} services - Object with service names as keys
     * @throws {Error} If any service is null/undefined
     * @protected
     */
    validateDependencies(services) {
        for (const [name, service] of Object.entries(services)) {
            if (!service) {
                const error = new Error(`Required dependency '${name}' not initialized in ${this.constructor.name}`);
                logger.error(error.message);
                throw error;
            }
        }
    }

    /**
     * Handle common callback data parsing
     * @param {String} callbackData - Raw callback data
     * @param {String} prefix - Expected prefix
     * @returns {String} Parsed action (without prefix)
     * @protected
     */
    parseCallbackData(callbackData, prefix) {
        if (!callbackData || typeof callbackData !== 'string') {
            throw new Error('Invalid callback data');
        }

        if (!callbackData.startsWith(prefix)) {
            throw new Error(`Callback data does not start with expected prefix: ${prefix}`);
        }

        return callbackData.replace(prefix, '');
    }
}
