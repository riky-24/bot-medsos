import { MESSAGES } from '../config/messages.js';
import { MenuHandler } from './handlers/MenuHandler.js';
import { PaymentHandler } from './handlers/PaymentHandler.js';
import logger from '../../../shared/services/Logger.js';
import { GameSelectionHandler } from './handlers/GameSelectionHandler.js';

import { CallbackRouter } from './handlers/CallbackRouter.js';
import { UIPersistenceHelper } from './helpers/UIPersistenceHelper.js';
import { PERMISSIONS } from '../security/authz/permissions.js';

/**
 * CommandHandlers
 * Role: Thin coordinator/facade that delegates to specialized handlers
 * Now with config injection pattern
 */
export class CommandHandlers {
  constructor(botCore, gameService, paymentService = null, config) {
    this.bot = botCore;
    this.gameService = gameService;
    this.paymentService = paymentService;
    this.config = config;

    // Shared UI Helper
    this.ui = new UIPersistenceHelper(botCore.sendPort, botCore.sessionService);

    // Initialize specialized handlers (Dependency Injection maintained)
    this.menuHandler = new MenuHandler(gameService);
    this.paymentHandler = new PaymentHandler(paymentService, botCore.sendPort, botCore.sessionService, config, gameService, this.ui);
    this.gameSelectionHandler = new GameSelectionHandler(
      gameService,
      botCore.sendPort,
      botCore.sessionService,
      config,
      this.ui
    );

    this.callbackRouter = new CallbackRouter(
      this.menuHandler,
      this.paymentHandler,
      this.gameSelectionHandler,
      botCore.sendPort,
      botCore.sessionService,
      config, // Pass config
      this.ui, // Pass shared UI
      botCore.authPort // Pass Auth Port
    );
  }

  /**
   * Register bot commands
   */
  registerCommands() {
    this.bot.onCommand('/start', this.handleStart.bind(this));

    this.bot.onCommand('/help', this.handleHelp.bind(this));
  }

  /**
   * Get menu options by type (legacy compatibility method)
   * Delegates to MenuHandler
   * @param {String} type - Menu type
   * @returns {Object} Menu markup
   */
  async getMenuOptions(type) {
    return await this.menuHandler.getMenuOptions(type);
  }

  /**
   * Handle /start command
   */
  async handleStart(chatId, args, sender) {
    // SECURITY CHECK
    if (this.bot.authZ && !await this.bot.authZ.can({ id: chatId, chatId }, PERMISSIONS.ACCESS_BOT)) {
      return await sender.sendMessage(chatId, "⛔ Akun Anda diblokir dari sistem.");
    }

    // Clear session on /start
    if (this.bot.sessionService) await this.bot.sessionService.clearSession(chatId);

    // /start always resets the bubble for a fresh professional look
    await sender.sendMessage(
      chatId,
      this.config.messages.WELCOME(),
      {
        reply_markup: this.menuHandler.getMainMenu(),
        forceNew: true
      }
    );
  }

  /**
   * Handle /help command
   */
  async handleHelp(chatId, args, sender) {
    await sender.sendMessage(
      chatId,
      this.config.messages.HELP || "Butuh bantuan? Silakan gunakan menu di bawah.",
      { reply_markup: this.menuHandler.getMainMenu() }
    );
  }

  /**
   * Handle order review (exposed for HandleMessageUseCase)
   * Delegates to PaymentHandler
   * @param {String} chatId - Telegram chat ID
   * @param {Object} orderData - Order information
   * @param {Object} sender - SendPort instance
   * @param {String} senderName - Name of the user (firstname or username)
   */
  async handleOrderReview(chatId, orderData, sender, senderName = '') {
    await this.paymentHandler.handleOrderReview(chatId, orderData, senderName);
  }

  /**
   * Handle callback query (button click)
   * Delegates to CallbackRouter
   * @param {Object} callbackQuery - Callback query object
   * @param {Object} sender - SendPort instance
   */
  async handleCallback(callbackQuery, sender) {
    const { data, message } = callbackQuery;
    const chatId = message.chatId;

    // Route callback first to get result
    const routeResult = await this.callbackRouter.route(
      data,
      chatId,
      this.handleStart.bind(this),
      message.messageId // New: Pass messageId for editing
    );

    // Acknowledge callback (stop spinner + optional toast)
    if (message.callbackId) {
      try {
        const toastText = routeResult?.toast || '';
        await sender.answerCallbackQuery(message.callbackId, toastText);
      } catch (e) {
        logger.warn(`[CommandHandlers] Failed to answer callback: ${e.message}`);
      }
    }
  }

  /**
   * Expose handlers for external access if needed
   */
  getMenuHandler() {
    return this.menuHandler;
  }

  getPaymentHandler() {
    return this.paymentHandler;
  }

  getGameSelectionHandler() {
    return this.gameSelectionHandler;
  }
}
