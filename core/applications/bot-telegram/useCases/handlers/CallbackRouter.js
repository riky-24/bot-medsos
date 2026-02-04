import { MenuRouter } from './MenuRouter.js';
import { ActionRouter } from './ActionRouter.js';
import logger from '../../../../shared/services/Logger.js';
import { GuideRouter } from './GuideRouter.js';
import { PaymentChannelHandler } from './PaymentChannelHandler.js';
import { PERMISSIONS } from '../../security/authz/permissions.js';

/**
 * CallbackRouter (Refactored)
 * Orchestrates routing to specialized routers
 * Responsibility: Parse callbacks and delegate to appropriate router
 */
export class CallbackRouter {
  constructor(menuHandler, paymentHandler, gameSelectionHandler, sendPort, sessionService = null, config, ui = null, authPort = null) {
    // Create dependencies object for routers
    const deps = {
      sendPort,
      menuHandler,
      paymentHandler,
      gameSelectionHandler,
      sessionService,
      paymentService: paymentHandler?.paymentService,
      ui, // Shared UI Helper
      authPort // Security Port
    };

    // Initialize specialized routers with config injection
    this.menuRouter = new MenuRouter(deps, config);
    this.actionRouter = new ActionRouter(deps, config);
    this.guideRouter = new GuideRouter(deps, config);
    this.channelHandler = new PaymentChannelHandler(deps, config);

    // Store for direct access if needed
    this.sendPort = sendPort;
    this.menuHandler = menuHandler;
    this.gameSelectionHandler = gameSelectionHandler; // Stored for access
    this.sessionService = sessionService; // Required for UIPersistenceHelper
    this.messages = config.messages;
    this.ui = ui;
    this.authPort = authPort;
  }

  /**
   * Route callback query to appropriate handler
   * @param {String} callbackData - Callback data from button click
   * @param {String} chatId - Telegram chat ID
   * @param {Function} startHandler - Start command handler (for home navigation)
   * @param {Number} messageId - Message ID for editing
   */
  async route(callbackData, chatId, startHandler, messageId = null) {
    logger.debug(`[CallbackRouter] Routing: ${callbackData}`);

    try {
      // SECURITY CHECK: Global Ban
      // User context minimal: { id: chatId }
      const userContext = { id: chatId };

      let hasAccess = true;
      if (this.authPort) {
        hasAccess = await this.authPort.can(userContext, PERMISSIONS.ACCESS_BOT);
      }

      if (!hasAccess) {
        logger.warn(`[CallbackRouter] ⛔ Blocked Banned User: ${chatId}`);
        return { toast: "❌ Akun Anda diblokir sementara." };
      }

      // Parse callback data format: "prefix_action" or "prefix_action_data"
      const parts = callbackData.split('_');
      const prefix = parts[0]; // menu, action, guide, game, product
      const action = parts.slice(1).join('_'); // everything after prefix

      switch (prefix) {
        case 'menu':
          const result = await this.menuRouter.route(action, chatId, messageId);
          // Return the result (containing potential toast)
          if (result && result.delegateTo === 'paymentChannel') {
            logger.info(`[CallbackRouter] Delegating to PaymentChannel. Mode: ${result.mode}`);
            await this.displayPaymentChannels(result.chatId, result.messageId, result.mode || 'payment');
          }
          return result;

        // Remove manual menu_info check since MenuRouter handles it now via 'menu' prefix


        case 'action':
          return await this.actionRouter.route(action, chatId, messageId);

        case 'guide':
          // Payment Guide (Checkout Mode)
          {
            const channelCode = callbackData.replace('guide_', '');
            return await this.guideRouter.showGuide(channelCode, chatId, messageId, false); // isInfoMode = false
          }

        case 'info':
          // Payment Guide (Info Mode)
          {
            const channelCode = callbackData.replace('info_', '');
            return await this.guideRouter.showGuide(channelCode, chatId, messageId, true); // isInfoMode = true
          }

        case 'game':
          // Delegate to game selection handler
          return await this.handleGameCallback(action, chatId, messageId);


        case 'prod':
          // Delegate to game selection handler
          return await this.handleProductCallback(callbackData, chatId, messageId);

        case 'home':
        case 'start':
          // Navigate to home/start
          if (startHandler) {
            await startHandler();
          } else {
            await this.menuHandler.showMainMenu(chatId);
          }
          return { toast: '' }; // stop spinner

        case 'delete':
          if (callbackData === 'delete_msg') {
            try {
              await this.sendPort.deleteMessage(chatId, messageId);
            } catch (e) { /* ignore delete error */ }
          }
          return { toast: '' }; // stop spinner

        case 'status':
          if (action.startsWith('empty')) {
            return { toast: this.messages.ERR_OUT_OF_STOCK || "⚠️ Produk sedang kosong." };
          }
          return { toast: '' };

        default:
          logger.warn(`[CallbackRouter] Unknown prefix: ${prefix} | ChatId: ${chatId}`);
          await this.ui.sendOrEdit(chatId, this.messages.ERR_ACTION_UNKNOWN);
      }
    } catch (error) {
      logger.error(`[CallbackRouter] Routing error: ${error.message}`, error);
      const errorMsg = this.messages.ERROR(error.message);
      await this.ui.sendOrEdit(chatId, errorMsg);
    }
  }



  /**
   * Handle game selection callbacks
   * Delegates to GameSelectionHandler
   * @private
   */
  async handleGameCallback(action, chatId, messageId) {
    // Format: "CODE" or "CODE_page_N"
    const parts = action.split('_');

    // Case 1: Pagination "CODE_page_N"
    if (action.includes('_page_')) {
      // parts: ['CODE', 'page', 'N']
      const gameCode = parts[0];
      const page = parseInt(parts[2], 10);

      if (isNaN(page)) {
        logger.error(`[CallbackRouter] Invalid page number: ${parts[2]}`);
        return;
      }

      await this.gameSelectionHandler.handleGamePagination(chatId, gameCode, page, messageId);
    }
    // Case 2: Selection "CODE"
    else {
      const gameCode = parts[0];
      await this.gameSelectionHandler.handleGameSelection(chatId, gameCode, messageId);
    }
  }

  /**
   * Handle product selection callbacks
   * Delegates to GameSelectionHandler
   * @private
   */
  async handleProductCallback(callbackData, chatId, messageId) {
    // Format: "prod_GAMECODE:ITEMCODE"
    // GameSelectionHandler expects full callbackData string to parse
    await this.gameSelectionHandler.handleProductSelection(chatId, callbackData, messageId);
  }

  /**
   * Display payment channels (public method for compatibility)
   */
  async displayPaymentChannels(chatId, messageId = null, mode = 'payment') {
    await this.channelHandler.displayChannels(chatId, messageId, mode);
  }
}
