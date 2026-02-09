/**
 * @file MenuHandler.js
 * @description Generates menu keyboards for main navigation and game categorization
 * @responsibility Create and manage menu structures for user navigation (main menu, top-up categories, payment menu)
 * 
 * @requires GameService - Game data for dynamic menu generation
 * @requires MENUS - Static menu configurations
 * @requires generateTopUpMenu - Utility for paginated game menus
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Factory Pattern - Creates menu keyboard structures
 * 
 * @example
 * const menuHandler = new MenuHandler(gameService);
 * const menu = await menuHandler.getGroupedTopUpMenu('verified', 1);
 * // Returns keyboard with verified games (page 1)
 * 
 * @menu_types
 * - Main Menu: Primary navigation (Top Up, Payment Methods, History, etc.)
 * - Top-Up Categories: Game categorization (Verified, Regular, Vouchers)
 * - Grouped Top-Up: Paginated game lists per category
 * - Payment Menu: Payment channel selection
 * 
 * @related
 * - MenuRouter.js - Uses menus from this handler
 * - menus.js - Static menu configurations
 * - GameService.js - Provides game data
 */
import { MENUS, generateTopUpMenu } from '../../config/menus.js';
export class MenuHandler {
  /**
   * Constructor for MenuHandler
   * @param {Object} gameService - Service for fetching game data
   */
  constructor(gameService) {
    this.gameService = gameService;
  }

  /**
   * Get main menu keyboard
   * Contains buttons for Top Up, Payment Methods, History, etc.
   * @returns {Object} Telegram keyboard markup
   */
  getMainMenu() {
    return MENUS.MAIN;
  }

  /**
   * Get Category Selection Menu (The "Professional" Entry Point)
   * Displays buttons for Verified Games, Regular Games, Vouchers, etc.
   * @returns {Object} Telegram keyboard object
   */
  getTopUpCategoryMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Game Terverifikasi", callback_data: "menu_topup_cat_verified" }],
          [{ text: "🎮 Game Lainnya", callback_data: "menu_topup_cat_regular" }],
          [{ text: "🎟️ Voucher & Digital", callback_data: "menu_topup_cat_vouchers" }],
          [{ text: "🔙 Kembali", callback_data: "menu_main" }]
        ]
      }
    };
  }

  /**
   * Generate dynamic top-up menu for a specific category
   * Fetches games from GameService and creates a paginated menu
   * 
   * @param {string} [category='verified'] - Game category ('verified', 'regular', 'vouchers')
   * @param {number} [page=1] - Page number
   * @returns {Promise<Object>} Telegram keyboard object with paginated games
   */
  async getGroupedTopUpMenu(category = 'verified', page = 1) {
    const grouped = await this.gameService.getGroupedAvailableGames();
    const games = grouped[category] || [];

    const result = generateTopUpMenu(games, page);

    // Customize callback data to preserve category during pagination
    // Format: menu_topup_cat_verified_page_2
    result.reply_markup.inline_keyboard = result.reply_markup.inline_keyboard.map(row => {
      return row.map(btn => {
        if (btn.callback_data?.startsWith('menu_topup_page_')) {
          const p = btn.callback_data.split('_').pop();
          return { ...btn, callback_data: `menu_topup_cat_${category}_page_${p}` };
        }
        // Back button in grouped menu should go back to category selection
        if (btn.callback_data === 'menu_main') {
          return { ...btn, text: '🔙 Kembali ke Kategori', callback_data: 'menu_topup' };
        }
        return btn;
      });
    });

    return result;
  }

  /**
   * Default handler for Top Up Menu
   * Legacy support, redirects to Category Menu
   * 
   * @param {number} [page=1] - Page number (unused in category view)
   * @returns {Promise<Object>} Telegram keyboard object
   */
  async getTopUpMenu(page = 1) {
    // For now, default to Showing Categories
    return this.getTopUpCategoryMenu();
  }

  /**
   * Get Payment Methods menu
   * @returns {Object} Telegram keyboard markup
   */
  getPaymentMenu() {
    return MENUS.PAYMENT;
  }

  /**
   * Get 'Back to Home' keyboard
   * Simple keyboard with single button to return home
   * @returns {Object} Telegram keyboard markup
   */
  getBackToHomeMenu() {
    return MENUS.BACK_TO_HOME;
  }

  /**
   * Get arbitrary menu options by type
   * Factory method for retrieving specific menu configurations
   * 
   * @param {string} type - Menu type ('main', 'payment', 'topup')
   * @returns {Promise<Object>|Object} Requested menu object
   */
  async getMenuOptions(type) {
    switch (type) {
      case 'main': return this.getMainMenu();
      case 'payment': return this.getPaymentMenu();
      case 'topup': return await this.getTopUpMenu();
      default: return {};
    }
  }
}
