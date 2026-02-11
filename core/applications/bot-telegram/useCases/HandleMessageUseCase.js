import logger from '../../../shared/services/Logger.js';
import { SessionInputHandler } from './handlers/SessionInputHandler.js';
import { UIPersistenceHelper } from './helpers/UIPersistenceHelper.js';

/**
 * HandleMessageUseCase
 * Responsibility: Orchestrate message processing
 * Delegates specific logic to specialized handlers
 */
export class HandleMessageUseCase {
  constructor(deps) {
    // Basic Dependencies
    this.sendPort = deps.sendPort;
    this.commands = deps.commands;
    this.rateLimiter = deps.rateLimiter;
    this.commandHandlers = deps.commandHandlers;
    this.messages = deps.config?.messages || {};
    this.sessionService = deps.sessionService;
    this.config = deps.config;

    // UI Orchestrator
    this.ui = new UIPersistenceHelper(deps.sendPort, deps.sessionService);

    // Sub-Handlers (Modularized)
    this.sessionInputHandler = new SessionInputHandler(
      deps.sessionService,
      deps.sendPort,
      deps.config,
      deps.gameProviderService,
      deps.gameService,
      deps.inputValidationService,
      deps.nicknameRateLimiter,
      this.ui, // Pass persistence helper
      deps.authZ // AuthZ guard (updated param name)
    );
    this.inputValidationService = deps.inputValidationService;

    // Security Services
    this.authN = deps.authN; // Authentication Service
    this.authZ = deps.authZ; // Authorization Guard
  }

  /**
   * Main Execution Entry Point
   */
  async execute(message) {
    if (!message) return;

    // --- ZERO TOLERANCE: STRICT PERSISTENCE ---
    // Automatically delete user message to keep chat clean
    if (!message.isCallback()) {
      await this.ui.deleteSilently(message.chatId, message.messageId);
    }



    // --- AUTHENTICATION GATE ---
    if (this.authN) {
      try {
        const user = await this._authenticateUser(message);
        if (!user) {
          logger.warn(`[HandleMessage] Auth failed: ${message.chatId}`);
          await this.sendPort.sendMessage(message.chatId, "⛔ Akses ditolak.");
          return;
        }
        message.user = user;
      } catch (error) {
        logger.error(`[HandleMessage] AuthN error: ${error.message}`);
        return;
      }
    }

    // 1. Rate Limiter Check
    if (this.rateLimiter && !this.rateLimiter.canRequest(message.chatId)) {
      if (message.isCallback() && message.callbackId) {
        try { await this.sendPort.answerCallbackQuery(message.callbackId, this.messages.RATE_LIMIT_TOAST); } catch (e) { }
        return;
      }

      const now = Date.now();
      this.rateLimitNotifications = this.rateLimitNotifications || new Map();
      const lastNotify = this.rateLimitNotifications.get(message.chatId) || 0;

      if (now - lastNotify > 10000) {
        await this.ui.sendOrEdit(message.chatId, this.messages.RATE_LIMIT, {
          reply_markup: this.commandHandlers.menuHandler.getMainMenu()
        });
        this.rateLimitNotifications.set(message.chatId, now);
      }
      return;
    }

    // 2. Handle Callback Query
    if (message.isCallback()) {
      await this._handleCallback(message);
      return;
    }

    const words = message.text.split(" ");
    const cmdName = words[0];
    const args = words.slice(1);

    // 3. Priority: Session/Input Check
    // STRICT LOCK: Only allow session handling if there is a valid pending order WITH AN ITEM selected.
    // This prevents "zombie" sessions (just game selected) from accepting input.
    const pending = await this.sessionService.getPendingOrder(message.chatId);
    logger.debug(`[DEBUG] Pending session for ${message.chatId}: item=${pending?.item?.id || 'NONE'}, customData=${JSON.stringify(pending?.customData || {})}`);
    if (pending && pending.item) {
      logger.info(`[DEBUG] Calling SessionInputHandler for chatId: ${message.chatId}`);
      const handledBySession = await this.sessionInputHandler.handle(message);
      logger.debug(`[DEBUG] SessionInputHandler returned: ${handledBySession}`);
      if (handledBySession) return;
    }

    // 4. Priority: Registered Commands
    if (this.commands[cmdName]) {
      // Create a wrapped sender that uses UIPersistenceHelper
      const wrappedSender = {
        ...this.sendPort,
        sendMessage: (chatId, text, options) => this.ui.sendOrEdit(chatId, text, options)
      };
      await this.commands[cmdName](message.chatId, args, wrappedSender, message);
      return;
    }

    // 5. Strict Mode: Silent Ignore for everything else
    // If not a command and not handled by session -> Do Nothing.
    // Message was already deleted at the start.
    logger.debug(`[HandleMessage] Strict Silence: Ignored "${message.text}" from ${message.chatId}`);
  }

  /**
   * Handle Callback Queries
   */
  async _handleCallback(message) {
    if (this.commandHandlers) {
      await this.commandHandlers.handleCallback(
        { data: message.callbackData, message: message },
        this.sendPort
      );
    }
  }

  /**
   * Authenticate user from message
   * Auto-registers new users
   * @private
   */
  async _authenticateUser(message) {
    if (!this.authN) return null;

    // Safety check: message.from bisa undefined pada callback queries
    if (!message.from || !message.from.id) {
      logger.debug('[HandleMessage] Skipping auth: message.from not available');
      return null;
    }

    try {
      const user = await this.authN.authenticate({
        telegramId: String(message.from.id),
        chatId: String(message.chatId),
        username: message.from.username,
        firstName: message.from.firstName,
        lastName: message.from.lastName,
        languageCode: message.from.languageCode
      });
      return user;
    } catch (error) {
      if (error.message.includes('banned') || error.message.includes('inactive')) {
        logger.warn(`[HandleMessage] Access denied: ${error.message}`)
        return null;
      }
      throw error;
    }
  }
}
