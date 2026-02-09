import { MenuRouter } from './MenuRouter.js';
import { ActionRouter } from './ActionRouter.js';
import logger from '../../../../shared/services/Logger.js';
import { GuideRouter } from './GuideRouter.js';
import { PaymentChannelHandler } from './PaymentChannelHandler.js';
import { PERMISSIONS } from '../../security/authz/permissions.js';
import { RouterResponse } from './RouterResponse.js';
import { PARSING } from './HandlerConstants.js';

/**
 * @file CallbackRouter.js
 * @description Main callback orchestrator that routes Telegram button callbacks to specialized handlers
 * @responsibility Parse callback data, perform security checks, and delegate to appropriate sub-routers
 * 
 * @requires MenuRouter - Handles menu navigation callbacks
 * @requires ActionRouter - Handles payment actions and confirmations
 * @requires GuideRouter - Handles payment guide display
 * @requires PaymentChannelHandler - Handles payment channel selection
 * @requires GameSelectionHandler - Handles game and product selection
 * @requires AuthPort - Authorization service for permission checks
 * @requires SendPort - Telegram bot messaging interface
 * @requires SessionService - User session state management
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Router Pattern - Delegates to specialized routers based on callback prefix
 * 
 * @example
 * const callbackRouter = new CallbackRouter(menuHandler, paymentHandler, gameSelectionHandler, sendPort, sessionService, config, ui, authPort);
 * await callbackRouter.route('menu_topup', chatId, startHandler, messageId);
 * // Delegates to MenuRouter.route('topup', chatId, messageId)
 * 
 * @callback_format Callbacks follow pattern: "prefix_action" or "prefix_action_data"
 * Supported prefixes:
 * - menu: Menu navigation (e.g., menu_topup, menu_payment)
 * - action: Payment actions (e.g., action_pay_QRIS, action_cancel)
 * - guide: Payment guides - checkout mode (e.g., guide_QRIS)
 * - info: Payment guides - info mode (e.g., info_QRIS)
 * - game: Game selection (e.g., game_MLBB, game_MLBB_page_2)
 * - prod: Product selection (e.g., prod_MLBB:100DM)
 * - home/start: Navigate to main menu
 * - delete: Delete message (delete_msg)
 * - status: Status indicators (status_empty)
 * 
 * @security
 * - Global ban check via authPort.can(PERMISSIONS.ACCESS_BOT)
 * - Callback data parsing with error handling
 * - Delegation to authorized handlers only
 * 
 * @related
 * - MenuRouter.js - Menu navigation logic
 * - ActionRouter.js - Payment action logic
 * - GuideRouter.js - Payment guide display
 * - PaymentChannelHandler.js - Channel selection
 */

/**
 * CallbackRouter (Refactored)
 * Orchestrates routing to specialized routers
 * Responsibility: Parse callbacks and delegate to appropriate router
 */
export class CallbackRouter {
  /**
   * Constructor for CallbackRouter
   * Initializes all sub-routers and dependencies
   * 
   * @param {Object} menuHandler - Handler for menu generation
   * @param {Object} paymentHandler - Handler for payment UI and logic
   * @param {Object} gameSelectionHandler - Handler for game/product selection
   * @param {Object} sendPort - Telegram bot messaging interface
   * @param {Object} [sessionService=null] - Session management service
   * @param {Object} config - Configuration object with messages
   * @param {Object} [ui=null] - Pre-initialized UI helper
   * @param {Object} [authPort=null] - Authorization service
   */
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
   * Parses callback data prefix and delegates to specialized router
   * 
   * @param {string} callbackData - Raw callback data from button click
   * @param {string} chatId - Telegram chat identifier
   * @param {Function} startHandler - Start command handler (for home navigation)
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<RouterResponse|void>} Router response or void
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
        return RouterResponse.toast("❌ Akun Anda diblokir sementara.");
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
          return RouterResponse.toast(); // stop spinner

        case 'delete':
          if (callbackData === 'delete_msg') {
            try {
              await this.sendPort.deleteMessage(chatId, messageId);
            } catch (e) { /* ignore delete error */ }
          }
          return RouterResponse.toast(); // stop spinner

        case 'status':
          if (action.startsWith('empty')) {
            return RouterResponse.toast(this.messages.ERR_OUT_OF_STOCK || "⚠️ Produk sedang kosong.");
          }
          return RouterResponse.toast();

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
   * Delegates to GameSelectionHandler for game list or pagination
   * 
   * @param {string} action - Action string (e.g., 'MLBB' or 'MLBB_page_2')
   * @param {string} chatId - Telegram chat identifier
   * @param {number} messageId - Message ID for editing
   * @returns {Promise<void>}
   * @private
   */
  async handleGameCallback(action, chatId, messageId) {
    // Format: "CODE" or "CODE_page_N"
    const parts = action.split('_');

    // Case 1: Pagination "CODE_page_N"
    if (action.includes('_page_')) {
      // parts: ['CODE', 'page', 'N']
      const gameCode = parts[0];
      const page = parseInt(parts[2], PARSING.DECIMAL_RADIX);

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
   * Delegates to GameSelectionHandler for product details
   * 
   * @param {string} callbackData - Full callback string (e.g., 'prod_MLBB:100DM')
   * @param {string} chatId - Telegram chat identifier
   * @param {number} messageId - Message ID for editing
   * @returns {Promise<void>}
   * @private
   */
  async handleProductCallback(callbackData, chatId, messageId) {
    // Format: "prod_GAMECODE:ITEMCODE"
    // GameSelectionHandler expects full callbackData string to parse
    await this.gameSelectionHandler.handleProductSelection(chatId, callbackData, messageId);
  }

  /**
   * Display payment channels
   * Public method to allow external modules to trigger channel display
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @param {string} [mode='payment'] - Display mode ('payment' or 'info')
   * @returns {Promise<void>}
   */
  async displayPaymentChannels(chatId, messageId = null, mode = 'payment') {
    await this.channelHandler.displayChannels(chatId, messageId, mode);
  }
}
