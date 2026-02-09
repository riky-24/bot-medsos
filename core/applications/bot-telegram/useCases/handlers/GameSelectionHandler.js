import logger from '../../../../shared/services/Logger.js';

/**
 * @file GameSelectionHandler.js
 * @description Handles game selection, product listing, and pagination for game top-up services
 * @responsibility Display available games, show product lists with pagination, handle product selection
 * 
 * @requires GameService - Game and product data access
 * @requires SendPort - Telegram bot messaging interface
 * @requires SessionService - User session state management
 * @requires UIPersistenceHelper - Single bubble UI experience
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Single Responsibility - Only handles game selection logic, no payment processing
 * 
 * @example
 * const handler = new GameSelectionHandler(gameService, sendPort, sessionService, config, ui);
 * await handler.handleGameSelection(chatId, 'MLBB', messageId);
 * 
 * @features
 * - Paginated product display (10 items per page)
 * - Real-time price display from VIPReseller
 * - Support for game categories (verified vs regular)
 * - Automatic product sorting by price
 * 
 * @related
 * - CallbackRouter.js - Routes game/prod callbacks here
 * - GameService.js - Provides game and product data
 */

/**
 * GameSelectionHandler
 * Responsibility: Game selection and detail display only
 * Single Responsibility Principle: Handles ONLY game selection operations
 */
import { PAGINATION } from './HandlerConstants.js';

// Pagination Configuration
const ITEMS_PER_PAGE = PAGINATION.ITEMS_PER_PAGE;

export class GameSelectionHandler {
  /**
   * Constructor for GameSelectionHandler
   * 
   * @param {Object} gameService - Service untuk game/product data access
   * @param {Object} sendPort - Telegram bot messaging port
   * @param {Object} [sessionService=null] - Session management service
   * @param {Object} [config=null] - Configuration dengan messages
   * @param {Object} [ui=null] - Pre-initialized UI helper
   */
  constructor(gameService, sendPort, sessionService = null, config = null, ui = null) {
    this.gameService = gameService;
    this.sendPort = sendPort;
    this.sessionService = sessionService;
    this.messages = config?.messages || {};
    this.ui = ui;
  }

  /**
   * Handle user selecting a game from menu
   * Validates game exists and displays product list
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} gameCode - Game code (e.g., 'MLBB', 'FREEFIRE')
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<void>}
   */
  async handleGameSelection(chatId, gameCode, messageId = null) {
    logger.info(`[GameSelectionHandler] Handling selection for: ${gameCode}`);
    const games = await this.gameService.getAvailableGames();
    const game = games.find(g => g.code === gameCode);

    if (!game) {
      await this.sendGameNotFound(chatId);
      return;
    }

    await this.sendGameInstructions(chatId, game, messageId);
  }

  /**
   * Send game top-up instructions
   */
  async sendGameInstructions(chatId, game, messageId = null) {
    await this.displayProductList(chatId, game, 1, messageId);
  }

  /**
   * Display product list for selected game
   * Shows paginated list of available products with prices
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} game - Game object with code, name, category
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<void>}
   */
  async displayProductList(chatId, game, page = 1, messageId = null) {
    logger.debug(`[GameSelectionHandler] Displaying products for ${game.name}, Page: ${page}`);
    try {
      const services = await this.gameService.getGameServices(game.code);

      // Sort by price
      services.sort((a, b) => (a.priceBasic < b.priceBasic ? -1 : a.priceBasic > b.priceBasic ? 1 : 0));

      const totalPages = Math.ceil(services.length / ITEMS_PER_PAGE);

      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;

      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      const paginatedItems = services.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      let message = this.messages.GAME_TOPUP_TITLE(game.name) + '\n';
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += this.messages.GAME_CATEGORY(game.category) + '\n';
      message += this.messages.GAME_TOTAL_ITEMS(services.length) + '\n';
      message += this.messages.GAME_PAGE_INFO(page, totalPages) + '\n';
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += this.messages.GAME_SELECT_NOMINAL + '\n';

      const keyboard = { inline_keyboard: [] };

      paginatedItems.forEach(item => {
        // VIPReseller has unlimited stock - all synced items are available
        const isAvailable = true;
        const priceText = `Rp ${item.priceBasic.toLocaleString('id-ID')}`;
        const statusEmoji = '✅';

        keyboard.inline_keyboard.push([{
          text: `${statusEmoji} ${item.serviceName} - ${priceText}`,
          callback_data: `prod_${game.code}:${item.code}`
        }]);
      });

      const navButtons = [];
      if (page > 1) navButtons.push({ text: this.messages.BUTTON_PREV, callback_data: `game_${game.code}_page_${page - 1}` });
      if (page < totalPages) navButtons.push({ text: this.messages.BUTTON_NEXT, callback_data: `game_${game.code}_page_${page + 1}` });
      if (navButtons.length > 0) keyboard.inline_keyboard.push(navButtons);

      keyboard.inline_keyboard.push([{ text: this.messages.BUTTON_BACK_TO_MENU, callback_data: 'menu_topup' }]);

      await this.ui.sendOrEdit(chatId, message, { reply_markup: keyboard });

    } catch (error) {
      logger.error(`[GameSelectionHandler] Error displaying products: ${error.message}`);
      await this.ui.sendOrEdit(chatId, this.messages.ERR_GAME_LIST_FAILED(error.message));
    }
  }

  /**
   * Handle pagination navigation for product list
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} gameCode - Game code
   * @param {number} page - Target page number
   * @param {number} messageId - Message ID for editing
   * @returns {Promise<void>}
   */
  async handleGamePagination(chatId, gameCode, page, messageId) {
    const games = await this.gameService.getAvailableGames();
    const game = games.find(g => g.code === gameCode);
    if (game) {
      await this.displayProductList(chatId, game, page, messageId);
    }
  }

  /**
   * Handle product selection from list
   * Saves selected product to session and displays details
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} callbackData - Callback data (format: 'prod_GAMECODE:ITEMCODE')
   * @param {number} messageId - Message ID for editing
   * @returns {Promise<void>}
   */
  async handleProductSelection(chatId, callbackData, messageId) {
    let payload = callbackData.startsWith('prod_') ? callbackData.substring(5) : callbackData.substring(8);
    const splitIndex = payload.indexOf(':');
    const gameCode = payload.substring(0, splitIndex);
    const itemCode = payload.substring(splitIndex + 1);

    const item = await this.gameService.findServiceByCode(itemCode);
    if (!item) {
      await this.ui.sendOrEdit(chatId, this.messages.ERR_PRODUCT_NOT_FOUND(itemCode));
      return;
    }

    const games = await this.gameService.getAvailableGames();
    const gameInfo = games.find(g => g.code === gameCode) || {};
    const isVerified = !!gameInfo.validationCode;
    const categoryLabel = (gameInfo.isGame ?? true) ? 'Game' : (gameInfo.category || 'Produk');

    // Description fallback already handled during sync (Mobile Legends A → B)
    const description = item.description || null;
    const message = this.messages.GAME_SELECTED(gameInfo.name || "Game", item.serviceName, item.priceBasic, description, isVerified, categoryLabel);

    await this.ui.sendOrEdit(chatId, message);

    if (this.sessionService) {
      await this.sessionService.savePendingOrder(chatId, {
        game: gameCode,
        item: item.serviceName,
        price: item.priceBasic,
        code: item.code,
        lastMsgId: messageId
      });
    }
  }



  async sendGameNotFound(chatId) {
    await this.ui.sendOrEdit(chatId, this.messages.GAME_NOT_FOUND);
  }
}
