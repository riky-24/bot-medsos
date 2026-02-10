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
import { UIPersistenceHelper } from '../helpers/UIPersistenceHelper.js';

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
     * Lazily instantiates UIPersistenceHelper if not injected via constructor
     * @protected
     */
    ensureUI() {
        if (!this.ui) {
            this.ui = new UIPersistenceHelper(this.sendPort, this.sessionService);
            this._uiInitialized = true;
            logger.debug(`[${this.constructor.name}] UI helper initialized`);
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
     * Structured error logging (log only, no message to user)
     * Use this when you want rich context in logs without notifying the user.
     * 
     * @param {String} context - Action context (e.g., 'Display Products', 'Process Payment')
     * @param {Error} error - Error object
     * @param {Object} [meta={}] - Additional metadata for debugging
     * @param {String} [meta.chatId] - Telegram chat ID
     * @param {String} [meta.userId] - Telegram user ID
     * @param {String} [meta.input] - User input that triggered error
     * @param {String} [meta.action] - Callback action or command
     * @protected
     */
    logError(context, error, meta = {}) {
        const enriched = {
            handler: this.constructor.name,
            chatId: meta.chatId || 'unknown',
            userId: meta.userId || meta.chatId || 'unknown',
            ...(meta.input && { input: meta.input }),
            ...(meta.action && { action: meta.action }),
            error: error.message,
            stack: error.stack
        };
        // Remove internal fields from spread
        const { chatId, userId, input, action, ...extra } = meta;
        Object.assign(enriched, extra);

        logger.error(`[${this.constructor.name}] ${context} | ChatId: ${enriched.chatId} | Error: ${error.message}`, enriched);
    }

    /**
     * Generate short error tracking ID for user reference
     * Format: ERR-XXXXXX (6 chars alphanumeric)
     * @returns {string} Error tracking ID
     * @private
     */
    _generateErrorId() {
        return 'ERR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    /**
     * Log and send error to user
     * Combines structured error logging with user notification
     * @param {String} context - Log context (e.g., method name)
     * @param {Error} error - Error object
     * @param {String} chatId - Chat identifier
     * @param {String} [userMessage=null] - User-facing error message
     * @param {Object} [meta={}] - Additional metadata for logging
     */
    async logAndSendError(context, error, chatId, userMessage = null, meta = {}) {
        this.logError(context, error, { chatId, ...meta });

        const message = userMessage || this.messages.ERR_GENERIC || 'Terjadi kesalahan. Silakan coba lagi.';
        await this.sendError(chatId, message);
    }

    /**
     * Centralized error handler with tracking ID (SAFE - no info leak)
     * Logs full error internally, shows only generic message + tracking ID to user.
     * Use this instead of ERROR(error.message) to prevent exposing internals.
     * 
     * @param {String} context - Action context (e.g., 'Pay Error', 'Route Error')
     * @param {Error} error - Error object
     * @param {String} chatId - Chat identifier
     * @param {Object} [meta={}] - Additional metadata for logging
     * @returns {Promise<void>}
     */
    async handleError(context, error, chatId, meta = {}) {
        const errorId = this._generateErrorId();

        // Log full details (internal only)
        this.logError(context, error, { chatId, errorId, ...meta });

        // Show SAFE message to user (no raw error.message)
        const safeMessage = this.messages.ERROR
            ? this.messages.ERROR(`Terjadi gangguan sistem. Kode: ${errorId}`)
            : `⚠️ Terjadi kesalahan. Kode: ${errorId}\n\nSilakan coba lagi atau hubungi Admin.`;

        await this.sendError(chatId, safeMessage);
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
